<?php

/*
 * MikoPBX - free phone system for small business
 * Copyright © 2017-2023 Alexey Portnov and Nikolay Beketov
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */

namespace MikoPBX\AdminCabinet\Controllers;

use MikoPBX\AdminCabinet\Forms\ExtensionEditForm;
use MikoPBX\Common\Models\{Extensions, Sip, Users};
use MikoPBX\Common\Providers\PBXCoreRESTClientProvider;

use function MikoPBX\Common\Config\appPath;

class ExtensionsController extends BaseController
{
    /**
     * Build the list of internal numbers and employees.
     */
    public function indexAction(): void
    {
    }

    /**
     * Fetches new records based on the request and populates the view
     *
     * @return void
     */
    public function getNewRecordsAction(): void
    {
        // Fetching parameters from POST request
        $postData = self::sanitizeData($this->request->getPost(), $this->filter);

        $currentPage = $postData['draw'];
        $position = $postData['start'];
        $recordsPerPage = $postData['length'];
        $searchPhrase = $postData['search']['value'] ?? '';
        $order = $postData['order'];
        $columns = $postData['columns'];

        // Initializing view variables
        $this->view->draw = $currentPage;
        $this->view->recordsFiltered = 0;
        $this->view->data = [];

        // Building query parameters
        $parameters = $this->buildQueryParameters();

        // Count the number of unique calls considering filters
        if (!empty($searchPhrase)) {
            $this->prepareConditionsForSearchPhrases($searchPhrase, $parameters);
        }

        // Execute the query and populate recordsFiltered
        $this->executeCountQuery($searchPhrase, $parameters);

        // Update query parameters for the main query
        $this->updateMainQueryParameters($parameters, $order, $columns, $recordsPerPage, $position);

        // Execute the main query and populate the view
        $this->executeMainQuery($parameters);
    }

    /**
     * Builds the initial query parameters for database queries
     *
     * @return array The array of query parameters
     */
    private function buildQueryParameters(): array
    {
        return [
            'models' => [
                'Users' => Users::class,
            ],
            'joins' => [
                'Sip' => [
                    0 => Sip::class,
                    1 => 'Sip.extension=Extensions.number',
                    2 => 'Sip',
                    3 => 'INNER',
                ],
                'Extensions' => [
                    0 => Extensions::class,
                    1 => 'Extensions.userid=Users.id and Extensions.is_general_user_number = "1" and Extensions.type="' . Extensions::TYPE_SIP . '"',
                    2 => 'Extensions',
                    3 => 'INNER',
                ],
                'ExternalExtensions' => [
                    0 => Extensions::class,
                    1 => 'ExternalExtensions.userid=Users.id and Extensions.is_general_user_number = "1" and ExternalExtensions.type="' . Extensions::TYPE_EXTERNAL . '"',
                    2 => 'ExternalExtensions',
                    3 => 'LEFT',
                ],
            ],
        ];
    }

    /**
     * Prepares conditions for database query based on the search phrase
     *
     * @param string $searchPhrase The search phrase to filter by
     * @param array $parameters Reference to the database query parameters
     * @return void
     */
    private function prepareConditionsForSearchPhrases(string $searchPhrase, array &$parameters): void
    {
        // Convert the search phrase to lowercase for case-insensitive matching
        $searchPhrase = mb_strtolower($searchPhrase, 'UTF-8');

        // Determine the condition based on specific keywords in the search phrase
        if (str_starts_with($searchPhrase, 'id:')) {
            // If the search phrase starts with 'id:', search by Extensions.id with exact match
            $id = substr($searchPhrase, 3); // Remove 'id:' prefix
            $parameters['conditions'] = 'Extensions.id = :SearchId:';
            $parameters['bind']['SearchId'] = (int) $id; // Cast ID to an integer for safety
        } elseif (str_starts_with($searchPhrase, 'email:')) {
            // If the search phrase starts with 'email:', search by User.email using a LIKE query
            $email = substr($searchPhrase, 6); // Remove 'email:' prefix
            $parameters['conditions'] = 'Users.email LIKE :SearchEmail:';
            $parameters['bind']['SearchEmail'] = "%$email%"; // Use partial matching for email
        } elseif (str_starts_with($searchPhrase, 'number:')) {
            // If the search phrase starts with 'number:', search by Extensions.number using a query
            $number = substr($searchPhrase, 7); // Remove 'number:' prefix
            $parameters['conditions'] = 'Extensions.number = :SearchNumber:';
            $parameters['bind']['SearchNumber'] = $number;
        } elseif (str_starts_with($searchPhrase, 'mobile:')) {
            // If the search phrase starts with 'mobile:', search by ExternalExtensions.mobile using a LIKE query$mobile = substr($searchPhrase, 7); // Remove 'mobile:' prefix
            $mobile = substr($searchPhrase, 7); // Remove 'number:' prefix
            $mobile = preg_replace('/\D/', '', $mobile); // Remove all non-digit characters
            $parameters['conditions'] = 'ExternalExtensions.number LIKE :SearchMobile:';
            $parameters['bind']['SearchMobile'] = "%$mobile%"; // Use partial matching for mobile number
        } else {
            // Default case: if no specific keyword is found, search by search_index field using a LIKE query
            $parameters['conditions'] = 'Extensions.search_index LIKE :SearchPhrase:';
            $parameters['bind']['SearchPhrase'] = "%$searchPhrase%"; // Use partial matching for the general search phrase
        }
    }

    /**
     * Executes the query to count filtered records and populates 'recordsFiltered'
     *
     * @param array $parameters The query parameters
     */
    private function executeCountQuery(string $searchPhrase, array $parameters): void
    {
        $parameters['columns'] = 'COUNT(DISTINCT(Users.id)) as rows';
        // Count the number of unique calls considering filters
        if (!empty($searchPhrase)) {
            $this->prepareConditionsForSearchPhrases($searchPhrase, $parameters);
        }
        $query = $this->di->get('modelsManager')->createBuilder($parameters)->getQuery();
        $recordsFilteredReq = $query->execute()->toArray();
        $this->view->setVar('recordsFiltered', $recordsFilteredReq[0]['rows'] ?? 0);
    }

    /**
     * Updates the query parameters for the main query based on pagination and sorting
     *
     * @param array $parameters Existing query parameters
     * @param array|null $order The sorting order
     * @param array|null $columns The columns to consider for sorting
     * @param int|null $recordsPerPage The number of records per page
     * @param int|null $position The starting position for the query
     */
    private function updateMainQueryParameters(array &$parameters, ?array $order, ?array $columns, ?int $recordsPerPage, ?int $position): void
    {
        // Find all Users that match the specified filter
        $parameters['columns'] = ['id' => 'Users.id'];
        $userOrder = 'CAST(Extensions.number AS INTEGER)';
        if (is_array($order) and is_array($columns)) {
            $columnName = $columns[$order[0]['column']]['data'] ?? 'number';
            $sortDirection = $order[0]['dir'] ?? 'asc';
            $userOrder = $columnName . ' ' . $sortDirection;
        }

        $parameters['limit'] = $recordsPerPage;
        $parameters['offset'] = $position;
        $parameters['order'] = $userOrder;

        $query = $this->di->get('modelsManager')->createBuilder($parameters)->getQuery();
        $selectedUsers = $query->execute()->toArray();
        $arrIDS = array_column($selectedUsers, 'id');
        if (empty($arrIDS)) {
            return;
        }

        $parameters = [
            'models' => [
                'Users' => Users::class,
            ],
            'columns' => [
                'id' => 'Extensions.id',
                'username' => 'Users.username',
                'number' => 'Extensions.number',
                'mobile' => 'ExternalExtensions.number',
                'user_id' => 'Users.id',
                'disabled' => 'Sip.disabled',
                'email' => 'Users.email',
                'type' => 'Extensions.type',
                'avatar' => 'Users.avatar',
                'search_index' => 'Extensions.search_index',
            ],
            'joins' => [
                'Sip' => [
                    0 => Sip::class,
                    1 => 'Sip.extension=Extensions.number',
                    2 => 'Sip',
                    3 => 'INNER',
                ],
                'Extensions' => [
                    0 => Extensions::class,
                    1 => 'Extensions.userid=Users.id and Extensions.is_general_user_number = "1" and Extensions.type="' . Extensions::TYPE_SIP . '"',
                    2 => 'Extensions',
                    3 => 'INNER',
                ],
                'ExternalExtensions' => [
                    0 => Extensions::class,
                    1 => 'ExternalExtensions.userid=Users.id and Extensions.is_general_user_number = "1" and ExternalExtensions.type="' . Extensions::TYPE_EXTERNAL . '"',
                    2 => 'ExternalExtensions',
                    3 => 'LEFT',
                ],
            ],
            'conditions' => 'Users.id IN ({ids:array})',
            'bind' => ['ids' => $arrIDS],
            'order' => $userOrder
        ];
    }

    /**
     * Executes the main query to fetch the records and populates the view data
     *
     * @param array $parameters The query parameters
     */
    private function executeMainQuery(array $parameters): void
    {
        $query = $this->di->get('modelsManager')->createBuilder($parameters)->getQuery();
        $selectedUsers = $query->execute()->toArray();

        $extensionTable = [];
        foreach ($selectedUsers as $userData) {
            if ($userData['avatar']) {
                $filename = md5($userData['avatar']);
                $imgCacheDir = appPath('sites/admin-cabinet/assets/img/cache');
                $imgFile = "$imgCacheDir/$filename.jpg";
                if (!file_exists($imgFile)) {
                    $this->base64ToJpegFile($userData['avatar'], $imgFile);
                }
                $userData['avatar'] = "{$this->url->get()}assets/img/cache/$filename.jpg";
            } else {
                $userData['avatar'] = "{$this->url->get()}assets/img/unknownPerson.jpg";
            }
            $userData['DT_RowId'] = $userData['id'];
            $userData['DT_RowClass'] = $userData['disabled'] === '1' ? 'extension-row disabled' : 'extension-row';
            $extensionTable[] = $userData;
        }
        $this->view->data = $extensionTable;
    }

    /**
     * Modify extension settings.
     *
     * @param string $id The ID of the extension being modified.
     *
     * @return void
     */
    public function modifyAction(string $id = ''): void
    {
        $restAnswer = $this->di->get(PBXCoreRESTClientProvider::SERVICE_NAME, [
            '/pbxcore/api/extensions/getRecord',
            PBXCoreRESTClientProvider::HTTP_METHOD_GET,
            ['id' => $id]
        ]);
        if ($restAnswer->success) {
            $getRecordStructure = (object)$restAnswer->data;
        } else {
            $this->flash->error(implode(', ', $restAnswer->messages));
            $this->dispatcher->forward([
                'controller' => 'extensions',
                'action' => 'index'
            ]);
            return;
        }

        // Create the form for editing the extension
        $form = new ExtensionEditForm($getRecordStructure);

        // Pass the form and extension details to the view
        $this->view->form = $form;
        $extension = Extensions::findFirstById($getRecordStructure->id) ?? new Extensions();
        $this->view->represent = $extension->getRepresent();
        $this->view->avatar = $getRecordStructure->user_avatar;
    }
}
