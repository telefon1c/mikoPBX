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

namespace MikoPBX\Tests\AdminCabinet\Tests\Traits;

use Facebook\WebDriver\Exception\NoSuchElementException;
use Facebook\WebDriver\Exception\TimeoutException;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;
use MikoPBX\Tests\AdminCabinet\Tests\Utils\CookieManager;
use RuntimeException;

/**
 * Trait LoginTrait
 * Handles authentication in tests with improved cookie management
 */
trait LoginTrait
{
    private ?CookieManager $cookieManager = null;

    /**
     * Initialize cookie manager
     *
     * @return void
     */
    protected function initializeCookieManager(): void
    {
        if (!isset($GLOBALS['SERVER_PBX'])) {
            throw new RuntimeException('SERVER_PBX global variable is not set');
        }

        // Extract domain from SERVER_PBX global
        $domain = parse_url($GLOBALS['SERVER_PBX'], PHP_URL_HOST);
        if (!$domain) {
            throw new RuntimeException('Could not extract domain from SERVER_PBX');
        }

        $this->cookieManager = new CookieManager(
            self::$driver,
            $domain,
            getenv('SELENIUM_COOKIE_DIR')
        );
    }

    /**
     * Test the login functionality
     *
     * @dataProvider loginDataProvider
     * @param array $params Login parameters
     * @return void
     */
    public function LoginOnMikoPbx(array $params): void
    {
        if ($this->cookieManager === null) {
            $this->initializeCookieManager();
        }

        $this->waitForAjax();

        // Try to restore session from cookies
        if ($this->tryLoginWithCookies()) {
            self::annotate('Successfully logged in using saved session');
            $this->assertTrue(true);
            return;
        }

        // Perform regular login
        $this->performLogin($params);
    }

    /**
     * Try to login using saved cookies
     *
     * @return bool
     */
    private function tryLoginWithCookies(): bool
    {
        if (!$this->cookieManager->loadCookies()) {
            return false;
        }

        try {
            // Navigate to dashboard or protected page
            self::$driver->navigate()->to($GLOBALS['SERVER_PBX']);
            $this->waitForAjax();

            // Check if login was successful
            return $this->isUserLoggedIn();
        } catch (\Exception $e) {
            self::annotate('Cookie login failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Perform login using credentials
     *
     * @param array $params Login parameters
     * @return void
     * @throws RuntimeException
     */
    private function performLogin(array $params): void
    {
        // Clear any existing cookies before login attempt
        $this->cookieManager->clearAll();

        $this->waitForAjax();

        // First attempt with primary password
        $this->changeInputField('login', $params['login']);
        $this->changeInputField('password', $params['password']);
        $this->submitLoginForm();

        // Try alternative password if first attempt failed
        if ($this->hasLoginFailed() && isset($params['password2'])) {
            $this->changeInputField('password', $params['password2']);
            $this->submitLoginForm();
        }

        if (!$this->isUserLoggedIn()) {
            throw new RuntimeException('Login failed: Credentials not accepted');
        } else {
            $this->assertTrue(true);
        }

        // Save successful login cookies
        if (!$this->cookieManager->saveCookies()) {
            self::annotate('Warning: Failed to save authentication cookies');
        }
    }

    /**
     * Submit the login form
     *
     * @return void
     * @throws RuntimeException
     */
    private function submitLoginForm(): void
    {
        try {
            $xpath = '//form[@id="login-form"]//ancestor::div[@id="submitbutton"]';
            $submitButton = self::$driver->findElement(WebDriverBy::xpath($xpath));
            $submitButton->click();
            $this->waitForAjax();
        } catch (\Exception $e) {
            throw new RuntimeException('Failed to submit login form: ' . $e->getMessage());
        }
    }

    /**
     * Check for visible error messages
     *
     * @return bool
     */
    private function hasLoginFailed(): bool
    {
        try {
            $xpath = '//div[contains(@class,"error") and contains(@class,"message")]';
            $errorMessages = self::$driver->findElements(WebDriverBy::xpath($xpath));

            foreach ($errorMessages as $errorMessage) {
                if ($errorMessage->isDisplayed()) {
                    return true;
                }
            }
        } catch (\Exception $e) {
            // If we can't check for errors, assume login hasn't failed
            self::annotate('Warning: Could not check for login errors: ' . $e->getMessage());
        }

        return false;
    }

    /**
     * Check if user is currently logged in
     *
     * @return bool
     */
    private function isUserLoggedIn(): bool
    {
        try {
            self::$driver->wait(15, 500)->until(
                WebDriverExpectedCondition::visibilityOfElementLocated(
                    WebDriverBy::id("top-menu-search")
                )
            );
            return true;
        } catch (NoSuchElementException|TimeoutException $e) {
            return false;
        } catch (\Exception $e) {
            self::annotate('Warning: Error checking login status: ' . $e->getMessage());
            return false;
        }
    }
    /**
     * Provide test login credentials
     *
     * @return array[]
     */
    public function loginDataProvider(): array
    {
        return [
            [
                [
                    'login' => 'admin',
                    'password' => '123456789MikoPBX#1',
                    'password2' => 'admin',
                ],
            ],
        ];
    }
}