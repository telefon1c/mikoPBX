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

use MikoPBX\AdminCabinet\Forms\MailSettingsEditForm;
use MikoPBX\Common\Models\PbxSettings;

class MailSettingsController extends BaseController
{
    /**
     * Modify mail settings action.
     *
     * @return void
     */
    public function modifyAction(): void
    {
        $MailSettingsFields = [];
        $arrKeys = $this->getEmailSettingsArray();

        // Retrieve the values of mail settings from PbxSettings
        foreach ($arrKeys as $key) {
            $MailSettingsFields[$key] = PbxSettings::getValueByKey($key);
        }

        $this->view->form       = new MailSettingsEditForm(null, $MailSettingsFields);
        $this->view->submitMode = null;
    }

    /**
     *  Get the list of keys for email settings on the station.
     *
     * @return array
     */
    private function getEmailSettingsArray(): array
    {
        return [
            PbxSettings::MAIL_SMTP_HOST,
            PbxSettings::MAIL_SMTP_PORT,
            PbxSettings::MAIL_SMTP_USERNAME,
            PbxSettings::MAIL_SMTP_PASSWORD,
            PbxSettings::MAIL_ENABLE_NOTIFICATIONS,
            PbxSettings::MAIL_SMTP_FROM_USERNAME,
            PbxSettings::MAIL_SMTP_SENDER_ADDRESS,
            PbxSettings::MAIL_SMTP_USE_TLS,
            PbxSettings::MAIL_SMTP_CERT_CHECK,
            PbxSettings::MAIL_TPL_MISSED_CALL_SUBJECT,
            PbxSettings::MAIL_TPL_MISSED_CALL_BODY,
            PbxSettings::MAIL_TPL_MISSED_CALL_FOOTER,
            PbxSettings::MAIL_TPL_VOICEMAIL_SUBJECT,
            PbxSettings::MAIL_TPL_VOICEMAIL_BODY,
            PbxSettings::MAIL_TPL_VOICEMAIL_FOOTER,
            PbxSettings::SYSTEM_NOTIFICATIONS_EMAIL,
            PbxSettings::SYSTEM_EMAIL_FOR_MISSED,
            PbxSettings::VOICEMAIL_NOTIFICATIONS_EMAIL,
        ];
    }

    /**
     * Saves the email settings based on the POST data.
     */
    public function saveAction(): void
    {
        if (! $this->request->isPost()) {
            return;
        }
        $data = $this->request->getPost();

        $this->db->begin();
        $arrSettings = $this->getEmailSettingsArray();
        foreach ($arrSettings as $key) {
            $record = PbxSettings::findFirstByKey($key);
            if ($record === null) {
                $record      = new PbxSettings();
                $record->key = $key;
            }

            switch ($key) {
                case PbxSettings::MAIL_ENABLE_NOTIFICATIONS:
                case PbxSettings::MAIL_SMTP_USE_TLS:
                case PbxSettings::MAIL_SMTP_CERT_CHECK:
                case "***ALL CHECK BOXES ABOVE***":
                    $record->value = ($data[$key] == 'on') ? "1" : "0";
                    break;
                default:
                    if (! array_key_exists($key, $data)) {
                        continue 2;
                    }
                    $record->value = $data[$key];
            }
            if ($record->save() === false) {
                $errors = $record->getMessages();
                $this->flash->warning(implode('<br>', $errors));
                $this->view->success = false;
                $this->db->rollback();

                return;
            }
        }

        $this->flash->success($this->translation->_('ms_SuccessfulSaved'));
        $this->view->success = true;
        $this->db->commit();
    }
}
