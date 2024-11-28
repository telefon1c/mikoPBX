<?php

namespace MikoPBX\Core\Workers\Libs\WorkerModelsEvents\Actions;

use MikoPBX\Core\System\PBX;
use MikoPBX\Core\System\Util;
use MikoPBX\Core\Workers\Cron\WorkerSafeScriptsCore;

class ReloadVoicemailAction implements ReloadActionInterface
{
    /**
     * Reloads Asterisk voicemail module
     *
     * @param array $parameters
     * @return void
     */
    public function execute(array $parameters = []): void
    {
        PBX::voicemailReload();
        // Restart WorkerNotifyByEmail;
        $pbxConsole = Util::which('pbx-console');
        shell_exec("$pbxConsole service WorkerNotifyByEmail stop");
        $worker = new WorkerSafeScriptsCore();
        $worker->start(['start']);
    }
}