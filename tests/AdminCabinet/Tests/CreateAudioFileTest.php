<?php

/*
 * MikoPBX - free phone system for small business
 * Copyright © 2017-2024 Alexey Portnov and Nikolay Beketov
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

namespace MikoPBX\Tests\AdminCabinet\Tests;

use MikoPBX\Tests\AdminCabinet\Lib\MikoPBXTestsBase;
use MikoPBX\Tests\AdminCabinet\Tests\Traits\LoginTrait;
use MikoPBX\Tests\AdminCabinet\Tests\Traits\AudioFilesTrait;

/**
 * Base class for Audio Files creation tests
 */
abstract class CreateAudioFileTest extends MikoPBXTestsBase
{
    use LoginTrait;
    use AudioFilesTrait;

    private static bool $isLoggedIn = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeCookieManager();
        if (!self::$isLoggedIn) {
            $loginData = $this->loginDataProvider();
            $this->testLogin($loginData[0][0]);
            self::$isLoggedIn = true;
        }

        $data = $this->getAudioFileData();
        $this->setSessionName("Test: Create Audio File - " . $data['name']);
    }

    /**
     * Get audio file data
     */
    abstract protected function getAudioFileData(): array;

    /**
     * Test creating an audio file
     */
    public function testCreateAudioFile(): void
    {
        $params = $this->getAudioFileData();
        self::annotate("Creating audio file: {$params['name']} ({$params['filename']})");

        try {
            $this->createAudioFile($params);
            if (!$params['for_delete']) {
                $this->verifyAudioFile($params['name']);
            }
            self::annotate("Successfully created audio file", 'success');
        } catch (\Exception $e) {
            self::annotate("Failed to create audio file", 'error');
            throw $e;
        }
    }

    /**
     * Create an audio file
     */
    protected function createAudioFile(array $params): void
    {
        $this->navigateToAudioFiles();
        $this->clearExistingFile($params['name']);
        $this->createNewAudioFile($params);
    }
}
