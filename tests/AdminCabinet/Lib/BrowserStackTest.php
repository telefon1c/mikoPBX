<?php

/*
 * MikoPBX - free phone system for small business
 * Copyright © 2017-2023 Alexey Portnov and Nikolay Beketov
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 */

namespace MikoPBX\Tests\AdminCabinet\Lib;

use Facebook\WebDriver\Remote\RemoteWebDriver;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;
use Facebook\WebDriver\WebDriverWait;
use GuzzleHttp\Client as GuzzleHttpClient;
use GuzzleHttp\Exception\GuzzleException;
use PHPUnit\Framework\TestCase;
use BrowserStack\Local as BrowserStackLocal;
use RuntimeException;

require_once 'globals.php';

/**
 * Base class for BrowserStack integration tests
 *
 * @package MikoPBX\Tests\AdminCabinet\Lib
 */
abstract class BrowserStackTest extends TestCase
{
    protected const WAIT_TIMEOUT = 30;
    protected const DEFAULT_SCREENSHOT_DIR = 'test-screenshots';

    protected static RemoteWebDriver $driver;
    protected static BrowserStackLocal $bs_local;
    protected static bool $testResult;
    protected static array $failureConditions;
    protected static GuzzleHttpClient $httpClient;

    /**
     * Configure and start BrowserStack session
     *
     * @throws \BrowserStack\LocalException
     */
    public static function setUpBeforeClass(): void
    {
        self::initializeHttpClient();
        self::setupBrowserStackCapabilities();
        self::initializeTestState();
    }

    /**
     * Initialize HTTP client for API requests
     */
    private static function initializeHttpClient(): void
    {
        self::$httpClient = new GuzzleHttpClient([
            'base_uri' => 'https://api.browserstack.com',
            'auth' => [
                $GLOBALS['BROWSERSTACK_USERNAME'],
                $GLOBALS['BROWSERSTACK_ACCESS_KEY']
            ]
        ]);
    }

    /**
     * Setup BrowserStack capabilities and start session
     *
     * @throws \BrowserStack\LocalException
     */
    private static function setupBrowserStackCapabilities(): void
    {
        $CONFIG = $GLOBALS['CONFIG'];
        $taskId = (int)getenv('TASK_ID') ?: 0;

        $caps = self::mergeBrowserStackCapabilities($CONFIG, $taskId);
        self::initializeBrowserStackLocal($caps);

        $url = sprintf(
            'https://%s:%s@%s/wd/hub',
            $GLOBALS['BROWSERSTACK_USERNAME'],
            $GLOBALS['BROWSERSTACK_ACCESS_KEY'],
            $CONFIG['server']
        );

        self::$driver = RemoteWebDriver::create($url, $caps, 120000, 120000);
    }

    /**
     * Merge BrowserStack capabilities
     *
     * @param array $config Configuration array
     * @param int $taskId Task identifier
     * @return array
     */
    private static function mergeBrowserStackCapabilities(array $config, int $taskId): array
    {
        $caps = $config['environments'][$taskId];
        foreach ($config['capabilities'] as $key => $value) {
            if (!array_key_exists($key, $caps)) {
                $caps[$key] = $value;
            }
        }
        $caps['build'] = $GLOBALS['BUILD_NUMBER'];
        return $caps;
    }

    /**
     * Initialize BrowserStack Local testing
     *
     * @param array $caps Capabilities array
     * @throws \BrowserStack\LocalException
     */
    private static function initializeBrowserStackLocal(array &$caps): void
    {
        if ($GLOBALS['BROWSERSTACK_DAEMON_STARTED'] === 'false') {
            $bs_local_args = [
                'key' => $GLOBALS['BROWSERSTACK_ACCESS_KEY'],
                'localIdentifier' => (string)$GLOBALS['bs_localIdentifier']
            ];
            self::$bs_local = new BrowserStackLocal();
            self::$bs_local->start($bs_local_args);
        } else {
            $caps['browserstack.local'] = (string)$GLOBALS['bs_local'];
            $caps['browserstack.localIdentifier'] = (string)$GLOBALS['bs_localIdentifier'];
        }
    }

    /**
     * Initialize test state variables
     */
    private static function initializeTestState(): void
    {
        self::$testResult = true;
        self::$failureConditions = [];
    }

    /**
     * Set up before each test
     *
     * @throws GuzzleException
     */
    protected function setUp(): void
    {
        parent::setUp();
        // $this->updateTestSessionName();
        $this->prepareTestEnvironment();
    }

//    /**
//     * Update test session name in BrowserStack
//     *
//     * @throws GuzzleException
//     */
//    private function updateTestSessionName(): void
//    {
//        $sessionId = self::$driver->getSessionID();
//        self::$httpClient->request('PUT', "/automate/sessions/{$sessionId}.json", [
//            'json' => ['name' => $this->getName(true)]
//        ]);
//    }

    /**
     * Prepare test environment
     */
    private function prepareTestEnvironment(): void
    {
        self::$driver->manage()->window()->maximize();
        self::$driver->get($GLOBALS['SERVER_PBX']);
    }

    /**
     * Helper method to wait for element
     *
     * @param string $selector CSS selector
     * @param int $timeout Timeout in seconds
     * @return mixed
     */
    protected function waitForElement(string $selector, int $timeout = self::WAIT_TIMEOUT)
    {
        $wait = new WebDriverWait(self::$driver, $timeout);
        return $wait->until(
            WebDriverExpectedCondition::presenceOfElementLocated(
                WebDriverBy::cssSelector($selector)
            )
        );
    }

    /**
     * Take screenshot of current page
     *
     * @param string $name Screenshot name
     * @return string Screenshot path
     */
    protected function takeScreenshot(string $name): string
    {
        $screenshotDir = self::DEFAULT_SCREENSHOT_DIR;
        if (!is_dir($screenshotDir) && !mkdir($screenshotDir, 0777, true)) {
            throw new RuntimeException("Failed to create screenshot directory");
        }

        $path = sprintf('%s/%s_%s.png', $screenshotDir, date('Y-m-d_H-i-s'), $name);
        self::$driver->takeScreenshot($path);
        return $path;
    }

    /**
     * Tear down after each test
     */
    protected function tearDown(): void
    {
        parent::tearDown();
        if ($this->getStatus() !== 0) {
            self::$testResult = false;
            $screenshotPath = $this->takeScreenshot($this->getName());
            self::$failureConditions[] = sprintf(
                'Test: %s Message: %s Screenshot: %s',
                $this->getName(true),
                $this->getStatusMessage(),
                $screenshotPath
            );
        }
    }

    /**
     * Tear down after all tests
     */
    public static function tearDownAfterClass(): void
    {
        self::updateTestSessionStatus();
        self::cleanupResources();
    }

    /**
     * Update test session status in BrowserStack
     */
    private static function updateTestSessionStatus(): void
    {
        try {
            $sessionId = self::$driver->getSessionID();
            $status = self::$testResult ? 'passed' : 'failed';
            $statusMessage = implode(PHP_EOL, self::$failureConditions);

            self::$httpClient->request('PUT', "/automate/sessions/{$sessionId}.json", [
                'json' => [
                    'status' => $status,
                    'reason' => $statusMessage,
                ]
            ]);
        } catch (GuzzleException $e) {
            error_log("Failed to update test session status: " . $e->getMessage());
        }
    }

    /**
     * Cleanup test resources
     */
    private static function cleanupResources(): void
    {
        self::$driver->quit();
        if (isset(self::$bs_local) && self::$bs_local) {
            self::$bs_local->stop();
        }
    }
}