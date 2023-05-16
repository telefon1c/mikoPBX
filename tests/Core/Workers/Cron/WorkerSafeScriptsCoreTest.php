<?php
/*
 * MikoPBX - free phone system for small business
 * Copyright (C) 2017-2023 Alexey Portnov and Nikolay Beketov
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

namespace MikoPBX\Tests\Core\Workers\Cron;

use MikoPBX\Core\Workers\Cron\WorkerSafeScriptsCore;
use MikoPBX\Tests\Unit\AbstractUnitTest;

class WorkerSafeScriptsCoreTest extends AbstractUnitTest
{

    public function testRestartAllWorkers():void
    {
        $worker = new WorkerSafeScriptsCore();
        $worker->restart();
        $this->assertTrue(true);
    }

    public function testStart():void
    {
        $worker = new WorkerSafeScriptsCore();
        $worker->start(['start']);
        $this->assertTrue(true);
    }

    public function testPrepareWorkersList():void
    {
        $worker = new WorkerSafeScriptsCore();
        $workers = $this->invokeMethod($worker, 'prepareWorkersList');
        $this->assertIsArray($workers);

    }

}
