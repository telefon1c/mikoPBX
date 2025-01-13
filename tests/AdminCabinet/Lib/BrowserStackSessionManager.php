<?php

namespace MikoPBX\Tests\AdminCabinet\Lib;

use Facebook\WebDriver\Remote\RemoteWebDriver;
use Facebook\WebDriver\Remote\WebDriverCommand;

class BrowserStackSessionManager
{
    private const STATE_FILE = '/tmp/browserstack_session_state.json';
    private static ?RemoteWebDriver $cachedDriver = null;

    private static function getState(): array
    {
        if (file_exists(self::STATE_FILE)) {
            $content = file_get_contents(self::STATE_FILE);
            return json_decode($content, true) ?? [
                'isInitialized' => false,
                'sessionId' => null,
                'testClass' => null
            ];
        }
        return [
            'isInitialized' => false,
            'sessionId' => null,
            'testClass' => null
        ];
    }

    private static function setState(array $state): void
    {
        file_put_contents(self::STATE_FILE, json_encode($state));
    }

    public static function isInitialized(): bool
    {
        $state = self::getState();
        $isInitialized = $state['isInitialized'];
        
        error_log(sprintf(
            "[BrowserStack] Checking initialization status: %s, Current session: %s, Test class: %s",
            $isInitialized ? 'true' : 'false',
            $state['sessionId'] ?? 'none',
            $state['testClass'] ?? 'none'
        ));
        
        return $isInitialized;
    }

    public static function setInitialized(bool $value, ?string $sessionId = null, ?string $testClass = null): void
    {
        $state = [
            'isInitialized' => $value,
            'sessionId' => $sessionId,
            'testClass' => $testClass
        ];
        self::setState($state);
        
        error_log(sprintf(
            "[BrowserStack] Setting initialization: %s, Session: %s, Test class: %s",
            $value ? 'true' : 'false',
            $sessionId ?? 'none',
            $testClass ?? 'none'
        ));
    }

    public static function getCurrentSessionId(): ?string
    {
        return self::getState()['sessionId'];
    }

    public static function getCurrentTestClass(): ?string
    {
        return self::getState()['testClass'];
    }

    public static function reset(): void
    {
        error_log("[BrowserStack] Resetting session manager state");
        if (file_exists(self::STATE_FILE)) {
            unlink(self::STATE_FILE);
        }
        self::clearCachedDriver();
    }

    public static function initialize(): void
    {
        if (!file_exists(self::STATE_FILE)) {
            self::setState([
                'isInitialized' => false,
                'sessionId' => null,
                'testClass' => null
            ]);
        }
    }

    public static function isSessionHealthy(?RemoteWebDriver $driver = null): bool
    {
        if ($driver === null) {
            return false;
        }

        try {
            // Try to execute a simple command to check session health
            $driver->getCurrentURL();
            error_log("[BrowserStack] Session health check passed");
            return true;
        } catch (\Exception $e) {
            error_log(sprintf(
                "[BrowserStack] Session health check failed: %s",
                $e->getMessage()
            ));
            return false;
        }
    }

    public static function invalidateSession(): void
    {
        error_log("[BrowserStack] Invalidating current session");
        $state = self::getState();
        $state['isInitialized'] = false;
        $state['sessionId'] = null;
        self::setState($state);
        self::clearCachedDriver();
    }

    public static function cacheDriver(RemoteWebDriver $driver): void
    {
        self::$cachedDriver = $driver;
    }

    public static function getCachedDriver(): ?RemoteWebDriver
    {
        return self::$cachedDriver;
    }

    public static function clearCachedDriver(): void
    {
        self::$cachedDriver = null;
    }
} 