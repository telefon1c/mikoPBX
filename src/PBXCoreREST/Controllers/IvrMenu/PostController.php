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

namespace MikoPBX\PBXCoreREST\Controllers\IvrMenu;

use MikoPBX\PBXCoreREST\Controllers\BaseController;
use MikoPBX\PBXCoreREST\Lib\IvrMenuManagementProcessor;

/**
 * Handles the POST requests for ivr menu data.
 *
 * @RoutePrefix("/pbxcore/api/ivr-menu")
 *
 * @examples
 *
 */
class PostController extends BaseController
{
    /**
     * Handles the call to different actions based on the action name
     *
     * @param string $actionName The name of the action
     *
     * Deletes the ivr menu record with its dependent tables.
     * @Post("/deleteRecord")
     *
     * @return void
     */
    public function callAction(string $actionName): void
    {
        $data = $this->request->getPost();
        $this->sendRequestToBackendWorker(IvrMenuManagementProcessor::class, $actionName, $data);
    }
}
