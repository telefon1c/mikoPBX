<?php

namespace MikoPBX\Tests\AdminCabinet\Lib;

use Exception;
use MikoPBX\Tests\AdminCabinet\Lib\Traits\AssertionTrait;
use MikoPBX\Tests\AdminCabinet\Lib\Traits\ElementInteractionTrait;
use MikoPBX\Tests\AdminCabinet\Lib\Traits\FormInteractionTrait;
use MikoPBX\Tests\AdminCabinet\Lib\Traits\NavigationTrait;
use MikoPBX\Tests\AdminCabinet\Tests\Traits\LoginTrait;
use MikoPBX\Tests\AdminCabinet\Lib\Traits\ScreenshotTrait;
use MikoPBX\Tests\AdminCabinet\Lib\Exceptions\TestException;
use RuntimeException;

/**
 * Base class for all MikoPBX UI tests
 */
class MikoPBXTestsBase extends BrowserStackTest
{
    use ElementInteractionTrait;
    use FormInteractionTrait;
    use NavigationTrait;
    use LoginTrait;
    use ScreenshotTrait;
    use AssertionTrait;

    /**
     * Global test configuration
     */
    protected const CONFIG = [
        'browser' => [
            'timeouts' => [
                'page_load' => 30,
                'script' => 30,
                'element' => 10
            ],
            'window' => [
                'width' => 1920,
                'height' => 1080
            ]
        ],
        'test' => [
            'retries' => 3,
            'delay' => 1,
            'screenshot_dir' => 'test-screenshots'
        ],
        'paths' => [
            'temp' => '/tmp/mikopbx-tests',
            'logs' => '/tmp/mikopbx-tests/logs'
        ]
    ];


    use LoginTrait;

    /**
     * @var bool Flag to track if login has been performed
     */
    private static bool $isLoggedIn = false;

    /**
     * Set up before class
     */
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        self::$isLoggedIn = false;
    }

    /**
     * Set up before each test
     *
     * @throws \Exception
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->configureDriver();
        $this->createTestDirectories();
        $this->initializeCookieManager();
        // Perform login if not already logged in
        if (!self::$isLoggedIn) {
            // Get login credentials from data provider
            $loginData = $this->loginDataProvider();
            $this->testLogin($loginData[0][0]);
            self::$isLoggedIn = true;
        }

        // Verify we're still logged in
        if (!$this->isUserLoggedIn()) {
            self::$isLoggedIn = false;
            $loginData = $this->loginDataProvider();
            $this->testLogin($loginData[0][0]);
            self::$isLoggedIn = true;
        }
    }

    /**
     * Configure WebDriver settings
     */
    private function configureDriver(): void
    {
        self::$driver->manage()->window()->setSize(
            new \Facebook\WebDriver\WebDriverDimension(
                self::CONFIG['browser']['window']['width'],
                self::CONFIG['browser']['window']['height']
            )
        );

        self::$driver->manage()->timeouts()->pageLoadTimeout(
            self::CONFIG['browser']['timeouts']['page_load']
        );

        self::$driver->manage()->timeouts()->setScriptTimeout(
            self::CONFIG['browser']['timeouts']['script']
        );
    }

    /**
     * Create necessary test directories
     */
    private function createTestDirectories(): void
    {
        foreach (self::CONFIG['paths'] as $path) {
            if (!is_dir($path) && !mkdir($path, 0777, true) && !is_dir($path)) {
                throw new RuntimeException("Failed to create directory: $path");
            }
        }
    }

    /**
     * Execute action with retry logic
     *
     * @param callable $action Action to execute
     * @param int $maxAttempts Maximum number of attempts
     * @param int $delay Delay between attempts in seconds
     * @return mixed
     * @throws Exception
     */
    protected function executeWithRetry(
        callable $action,
        int $maxAttempts = self::CONFIG['test']['retries'],
        int $delay = self::CONFIG['test']['delay']
    ): mixed {
        $lastException = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                return $action();
            } catch (Exception $e) {
                $lastException = $e;
                $this->logRetryAttempt($attempt, $maxAttempts, $e);

                if ($attempt < $maxAttempts) {
                    $this->waitForAjax();
                    sleep($delay);
                }
            }
        }

        throw new TestException(
            "Action failed after $maxAttempts attempts",
            0,
            $lastException
        );
    }

    /**
     * Add annotation in BrowserStack with proper JSON encoding
     *
     * @param string $text Annotation text
     * @param string $level Annotation level (info, warning, error)
     */
    public static function annotate(string $text, string $level = 'info'): void
    {
        $data = [
            'action' => 'annotate',
            'arguments' => [
                'level' => $level,
                'data' => $text
            ]
        ];

        $command = 'browserstack_executor: ' . json_encode($data);
        self::$driver->executeScript($command);
    }

    /**
     * Set BrowserStack session status using proper JSON encoding
     *
     * @param string $text Status message
     * @param string $status Status value
     */
    public static function setSessionStatus(string $text, string $status = 'failed'): void
    {
        $data = [
            'action' => 'setSessionStatus',
            'arguments' => [
                'status' => $status,
                'reason' => substr($text, 0, 256)
            ]
        ];

        $command = 'browserstack_executor: ' . json_encode($data);
        self::$driver->executeScript($command);
    }


    /**
     * Update current session name
     *
     * @param string $name Session name
     */
    /**
     * Update current session name in BrowserStack
     *
     * @param string $name Session name
     */
    public static function setSessionName(string $name): void
    {
        $data = [
            'action' => 'setSessionName',
            'arguments' => [
                'name' => $name
            ]
        ];

        $command = 'browserstack_executor: ' . json_encode($data);
        self::$driver->executeScript($command);
    }

    /**
     * Handle test action errors
     *
     * @param string $action Action description
     * @param string $message Error message
     * @param Exception $e Exception instance
     * @throws Exception
     */
    protected function handleActionError(string $action, string $message, Exception $e): void
    {
        $errorMessage = sprintf(
            "Failed to %s: %s. Error: %s",
            $action,
            $message,
            $e->getMessage()
        );

        $screenshotPath = $this->takeScreenshot($action);
        self::annotate("Test failure: $errorMessage", 'error');

        // Save page source for debugging
        $pageSource = self::$driver->getPageSource();
        $sourceFile = sprintf(
            '%s/failure_%s_%s.html',
            self::CONFIG['paths']['logs'],
            date('Y-m-d_H-i-s'),
            str_replace(' ', '_', $action)
        );
        file_put_contents($sourceFile, $pageSource);

        $this->fail(
            "$errorMessage\n" .
            "Screenshot saved at: $screenshotPath\n" .
            "Page source saved at: $sourceFile"
        );
    }

    /**
     * Log retry attempt
     *
     * @param int $attempt Current attempt number
     * @param int $max Maximum attempts
     * @param Exception $e Exception that caused retry
     */
    private function logRetryAttempt(int $attempt, int $max, Exception $e): void
    {
        self::annotate(
            sprintf(
                'Retry attempt %d/%d: %s',
                $attempt,
                $max,
                $e->getMessage()
            ),
            'warning'
        );
    }

    /**
     * Custom fail method with BrowserStack integration
     *
     * @param string $message Failure message
     */
    public static function fail(string $message = ''): void
    {
        self::setSessionStatus($message);
        parent::fail($message);
    }

    /**
     * Clean up method called after each test
     */
    protected function tearDown(): void
    {
        if ($this->hasFailed()) {
            $this->takeScreenshot('test_failure');
        }
        parent::tearDown();
    }

    /**
     * Log test action with context
     *
     * @param string $action Description of the action
     * @param array $context Additional context data
     * @param string $level Log level (info, warning, error)
     */
    protected function logTestAction(string $action, array $context = [], string $level = 'info'): void
    {
        try {
            // Format the message for BrowserStack annotation
            $message = $this->formatAnnotationMessage($action, $context);

            // Send to BrowserStack
            $this->annotate($message, $level);

            // Log locally if needed
            $this->writeToLocalLog($action, $context, $level);
        } catch (\Exception $e) {
            // Log error without throwing to avoid test interruption
            error_log("Failed to log test action: " . $e->getMessage());
        }
    }

    /**
     * Format message for BrowserStack annotation ensuring proper JSON encoding
     *
     * @param string $action Action description
     * @param array $context Context data
     * @return string
     */
    private function formatAnnotationMessage(string $action, array $context = []): string
    {
        // Start with the action description
        $message = "Test action: " . str_replace(["\n", "\r"], ' ', $action);

        // Add context if present
        if (!empty($context)) {
            // Convert context to single line JSON
            $contextJson = json_encode(
                $context,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );

            $message .= " | Context: " . $contextJson;
        }

        return $message;
    }

    /**
     * Write test action to local log file
     *
     * @param string $action Action description
     * @param array $context Context data
     * @param string $level Log level
     */
    private function writeToLocalLog(string $action, array $context, string $level): void
    {
        $logDir = self::CONFIG['paths']['logs'];

        if (!is_dir($logDir) && !mkdir($logDir, 0777, true) && !is_dir($logDir)) {
            throw new RuntimeException("Failed to create log directory: $logDir");
        }

        $logFile = sprintf(
            '%s/%s_test_actions.log',
            $logDir,
            date('Y-m-d')
        );

        $testInfo = [
            'class' => static::class,
            'method' => $this->getName(),
            'time' => date('Y-m-d H:i:s')
        ];

        $logEntry = sprintf(
            "[%s] [%s] %s\nTest: %s::%s\n%s\n",
            date('Y-m-d H:i:s'),
            strtoupper($level),
            $action,
            $testInfo['class'],
            $testInfo['method'],
            !empty($context) ? "Context: " . json_encode($context, JSON_PRETTY_PRINT) : ''
        );

        file_put_contents($logFile, $logEntry . "\n", FILE_APPEND);
    }
}
