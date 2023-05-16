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

namespace MikoPBX\Tests\Modules\ModuleBackup\Lib;

use Modules\ModuleBackup\Lib\Backup;
use MikoPBX\Tests\Unit\AbstractUnitTest;

class BackupTest extends AbstractUnitTest
{

    public function testDownload()
    {
        $backupId = 'backup_1594380302';
        $result = Backup::download(['id'=>$backupId]);
        $this->assertArrayHasKey('result', $result);
        $this->assertEquals('Success', $result['result']);
    }
}
