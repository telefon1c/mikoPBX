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

namespace MikoPBX\Core\Workers;

use MikoPBX\Common\Handlers\CriticalErrorsHandler;
use MikoPBX\Core\Asterisk\AsteriskManager;
use MikoPBX\Core\System\BeanstalkClient;
use MikoPBX\Core\System\Processes;
use MikoPBX\Core\System\SystemMessages;
use MikoPBX\Core\System\Util;
use Phalcon\Di\Injectable;
use MikoPBX\Common\Library\Text;
use RuntimeException;
use Throwable;

/**
 * Base class for workers.
 * Provides core functionality for process management, signal handling, and worker lifecycle.
 *
 * @package MikoPBX\Core\Workers
 */
abstract class WorkerBase extends Injectable implements WorkerInterface
{
    /**
     * Signals that should be handled by the worker
     */
    private const array MANAGED_SIGNALS = [
        SIGUSR1,
        SIGTERM,
        SIGINT
    ];
    /**
     * Worker state constants
     */
    protected const int STATE_STARTING = 1;
    protected const int STATE_RUNNING = 2;
    protected const int STATE_STOPPING = 3;
    protected const int STATE_RESTARTING = 4;

    /**
     * Worker state constants with descriptions
     */
    protected const array WORKER_STATES = [
        self::STATE_STARTING   => 'STARTING',
        self::STATE_RUNNING    => 'RUNNING',
        self::STATE_STOPPING   => 'STOPPING',
        self::STATE_RESTARTING => 'RESTARTING'
    ];

    /**
     * File system constants
     */
    private const string PID_FILE_DIR = '/var/run';
    private const string PID_FILE_SUFFIX = '.pid';

    /**
     * Resource limits
     */
    private const string MEMORY_LIMIT = '256M';
    private const int ERROR_REPORTING_LEVEL = E_ALL;

    /**
     * Log message format constants
     */
    private const string LOG_FORMAT_STATE = '[%s][%s->%s] %s (%.3fs, PID:%d)';
    private const string LOG_FORMAT_SIGNAL = '[%s][%s] %s from %s (%.3fs, PID:%d)';
    private const string LOG_FORMAT_NORMAL_SHUTDOWN = '[%s][RUNNING->SHUTDOWN] Clean exit from %s (%.3fs, PID:%d)';
    private const string LOG_FORMAT_NORMAL_EXIT = '[%s] Successfully executed (%.3fs, PID:%d)';
    private const string LOG_FORMAT_ERROR_SHUTDOWN = '[%s][SHUTDOWN-ERROR] %s from %s (%.3fs, PID:%d)';
    private const string LOG_FORMAT_PING = '[%s][PING] %s from %s (%.3fs, PID:%d)';


    private const string LOG_NAMESPACE_SEPARATOR = '\\';

    /**
     * Flag indicating whether the worker is a forked process
     *
     * @var bool
     */
    private bool $isForked = false;

    /**
     * Maximum number of processes that can be created
     *
     * @var int
     */
    public int $maxProc = 1;

    /**
     * Instance of the Asterisk Manager
     *
     * @var AsteriskManager
     */
    protected AsteriskManager $am;

    /**
     * Flag indicating whether the worker needs to be restarted
     *
     * @var bool
     */
    protected bool $needRestart = false;

    /**
     * Time the worker started
     *
     * @var float
     */
    protected float $workerStartTime;

    /**
     * Current state of the worker
     *
     * @var int
     */
    protected int $workerState = self::STATE_STARTING;

    /**
     * Constructs a WorkerBase instance.
     * Initializes signal handlers, sets up resource limits, and saves PID file.
     *
     * @throws RuntimeException If critical initialization fails
     */
    final public function __construct()
    {
        try {
            $this->setResourceLimits();
            $this->initializeSignalHandlers();
            register_shutdown_function([$this, 'shutdownHandler']);

            $this->workerStartTime = microtime(true);
            $this->setWorkerState(self::STATE_STARTING);
            $this->savePidFile();

        } catch (Throwable $e) {
            CriticalErrorsHandler::handleExceptionWithSyslog($e);
            throw $e;
        }
    }

    /**
     * Sets resource limits for the worker process
     */
    protected function setResourceLimits(): void
    {
        ini_set('memory_limit', self::MEMORY_LIMIT);
        error_reporting(self::ERROR_REPORTING_LEVEL);
        ini_set('display_errors', '1');
        set_time_limit(0);
    }


    /**
     * Initializes signal handlers for the worker
     */
    private function initializeSignalHandlers(): void
    {
        pcntl_async_signals(true);
        foreach (self::MANAGED_SIGNALS as $signal) {
            pcntl_signal($signal, [$this, 'signalHandler'], true);
        }
    }

    /**
     * Updates worker state and logs the change
     */
    protected function setWorkerState(int $state): void
    {
        $oldState = $this->workerState ?? 'UNDEFINED';
        $this->workerState = $state;

        $workerName = basename(str_replace(self::LOG_NAMESPACE_SEPARATOR, '/', static::class));
        $timeElapsed = round(microtime(true) - $this->workerStartTime, 3);
        $namespacePath = implode('.', array_slice(explode(self::LOG_NAMESPACE_SEPARATOR, static::class), 0, -1));

        SystemMessages::sysLogMsg(
            static::class,
            sprintf(
                self::LOG_FORMAT_STATE,
                $workerName,
                self::WORKER_STATES[$oldState] ?? 'UNDEFINED',
                self::WORKER_STATES[$state] ?? 'UNKNOWN',
                $namespacePath,
                $timeElapsed,
                getmypid()
            ),
            LOG_DEBUG
        );
    }


    /**
     * Save PID to file(s) with error handling
     *
     * @throws RuntimeException If unable to write PID file
     */
    /**
     * Handles PID file operations for worker processes
     */
    private function savePidFile(): void
    {
        try {
            $pid = getmypid();
            if ($pid === false) {
                throw new RuntimeException('Could not get process ID');
            }

            $pidFile = $this->getPidFile();
            $pidDir = dirname($pidFile);

            // Ensure PID directory exists
            if (!is_dir($pidDir) && !mkdir($pidDir, 0755, true)) {
                throw new RuntimeException("Could not create PID directory: $pidDir");
            }

            // For forked processes, append the PID to the filename
            if (isset($this->isForked) && $this->isForked === true) {
                $pidFile = $this->getForkedPidFile($pid);
            }

            // Use exclusive file creation to avoid race conditions
            $handle = fopen($pidFile, 'c+');
            if ($handle === false) {
                throw new RuntimeException("Could not open PID file: $pidFile");
            }

            if (!flock($handle, LOCK_EX | LOCK_NB)) {
                fclose($handle);
                throw new RuntimeException("Could not acquire lock on PID file: $pidFile");
            }

            // Write PID to file
            if (ftruncate($handle, 0) === false ||
                fwrite($handle, (string)$pid) === false) {
                flock($handle, LOCK_UN);
                fclose($handle);
                throw new RuntimeException("Could not write to PID file: $pidFile");
            }

            flock($handle, LOCK_UN);
            fclose($handle);

        } catch (Throwable $e) {
            SystemMessages::sysLogMsg(
                static::class,
                "Failed to save PID file: " . $e->getMessage(),
                LOG_WARNING
            );
            throw new RuntimeException('PID file operation failed', 0, $e);
        }
    }

    /**
     * Generate the PID file path for the worker
     *
     * @return string The path to the PID file
     */
    public function getPidFile(): string
    {
        $name = str_replace("\\", '-', static::class);
        return self::PID_FILE_DIR . "/$name" . self::PID_FILE_SUFFIX;
    }

    /**
     * Generates PID file path for forked processes
     *
     * @param int $pid Process ID
     * @return string Full path to the PID file
     */
    private function getForkedPidFile(int $pid): string
    {
        $basePidFile = $this->getPidFile();
        return sprintf(
            '%s.%d',
            $basePidFile,
            $pid
        );
    }

    /**
     * Starts the worker process
     *
     * @param array $argv Command-line arguments
     * @param bool $setProcName Whether to set process name
     * @return void
     */
    public static function startWorker(array $argv, bool $setProcName = true): void
    {
        $action = $argv[1] ?? '';
        if ($action === 'start') {
            $workerClassname = static::class;

            if ($setProcName) {
                cli_set_process_title($workerClassname);
            }

            try {
                $worker = new $workerClassname();
                $worker->setWorkerState(self::STATE_RUNNING);
                $worker->start($argv);
                $worker->logNormalExit();
            } catch (Throwable $e) {
                CriticalErrorsHandler::handleExceptionWithSyslog($e);
                sleep(1);
            }
        }
    }

    /**
     * Handles various signals received by the worker
     *
     * @param int $signal Signal number
     * @return void
     */
    public function signalHandler(int $signal): void
    {
        $workerName = basename(str_replace(self::LOG_NAMESPACE_SEPARATOR, '/', static::class));
        $timeElapsed = round(microtime(true) - $this->workerStartTime, 3);
        $namespacePath = implode('.', array_slice(explode(self::LOG_NAMESPACE_SEPARATOR, static::class), 0, -1));

        $signalNames = [
            SIGUSR1 => 'SIGUSR1',
            SIGTERM => 'SIGTERM',
            SIGINT  => 'SIGINT'
        ];

        SystemMessages::sysLogMsg(
            static::class,
            sprintf(
                self::LOG_FORMAT_SIGNAL,
                $workerName,
                $signalNames[$signal] ?? "SIG_$signal",
                'received',
                $namespacePath,
                $timeElapsed,
                getmypid()
            ),
            LOG_DEBUG
        );

        switch ($signal) {
            case SIGUSR1:
                $this->setWorkerState(self::STATE_RESTARTING);
                $this->needRestart = true;
                break;
            case SIGTERM:
            case SIGINT:
                $this->setWorkerState(self::STATE_STOPPING);
                exit(0);
            default:
                // Log unhandled signal
                SystemMessages::sysLogMsg(
                    $workerName,
                    sprintf("Unhandled signal received: %d", $signal),
                    LOG_WARNING
                );
        }
    }


    /**
     * Handles the shutdown event of the worker
     *
     * @return void
     */
    public function shutdownHandler(): void
    {
        $timeElapsedSecs = round(microtime(true) - $this->workerStartTime, 2);
        $processTitle = cli_get_process_title();

        $error = error_get_last();
        if ($error === null) {
            $this->logNormalShutdown($processTitle, $timeElapsedSecs);
        } else {
            $this->logErrorShutdown($processTitle, $timeElapsedSecs, $error);
        }

        $this->cleanupPidFile();
    }

    /**
     * Logs normal shutdown event
     *
     * @param string $processTitle Process title
     * @param float $timeElapsedSecs Time elapsed since start
     */
    private function logNormalShutdown(string $processTitle, float $timeElapsedSecs): void
    {
        $workerName = basename(str_replace(self::LOG_NAMESPACE_SEPARATOR, '/', static::class));
        $namespacePath = implode('.', array_slice(explode(self::LOG_NAMESPACE_SEPARATOR, static::class), 0, -1));

        SystemMessages::sysLogMsg(
            $processTitle,
            sprintf(
                self::LOG_FORMAT_NORMAL_SHUTDOWN,
                $workerName,
                $namespacePath,
                $timeElapsedSecs,
                getmypid()
            ),
            LOG_DEBUG
        );
    }

    /**
     * Logs error shutdown event
     *
     * @param string $processTitle Process title
     * @param float $timeElapsedSecs Time elapsed since start
     * @param array $error Error details
     */
    private function logErrorShutdown(string $processTitle, float $timeElapsedSecs, array $error): void
    {
        $workerName = basename(str_replace(self::LOG_NAMESPACE_SEPARATOR, '/', static::class));
        $namespacePath = implode('.', array_slice(explode(self::LOG_NAMESPACE_SEPARATOR, static::class), 0, -1));
        $errorMessage = $error['message'] ?? 'Unknown error';

        SystemMessages::sysLogMsg(
            $processTitle,
            sprintf(
                self::LOG_FORMAT_ERROR_SHUTDOWN,
                $workerName,
                $errorMessage,
                $namespacePath,
                $timeElapsedSecs,
                getmypid()
            ),
            LOG_ERR
        );
    }

    /**
     * Safely cleans up PID file during shutdown
     */
    private function cleanupPidFile(): void
    {
        try {
            $pid = getmypid();
            if ($pid === false) {
                return;
            }

            // Determine which PID file to remove
            $pidFile = isset($this->isForked) && $this->isForked === true
                ? $this->getForkedPidFile($pid)
                : $this->getPidFile();

            // Only remove the file if it exists and contains our PID
            if (file_exists($pidFile)) {
                $storedPid = file_get_contents($pidFile);
                if ($storedPid === (string)$pid) {
                    unlink($pidFile);
                }
            }
        } catch (Throwable $e) {
            SystemMessages::sysLogMsg(
                static::class,
                "Failed to cleanup PID file: " . $e->getMessage(),
                LOG_WARNING
            );
        }
    }

    /**
     * Handles ping callback to keep connection alive
     *
     * @param BeanstalkClient $message Received message
     * @return void
     */
    public function pingCallBack(BeanstalkClient $message): void
    {
        try {
            $workerName = basename(str_replace(self::LOG_NAMESPACE_SEPARATOR, '/', static::class));
            $namespacePath = implode('.', array_slice(explode(self::LOG_NAMESPACE_SEPARATOR, static::class), 0, -1));
            $timeElapsed = round(microtime(true) - $this->workerStartTime, 3);

            SystemMessages::sysLogMsg(
                cli_get_process_title(),
                sprintf(
                    self::LOG_FORMAT_PING,
                    $workerName,
                    substr(json_encode($message->getBody()), 0, 50),  // Truncate long messages
                    $namespacePath,
                    $timeElapsed,
                    getmypid()
                ),
                LOG_DEBUG
            );

            $message->reply(json_encode($message->getBody() . ':pong', JSON_THROW_ON_ERROR));
        } catch (Throwable $e) {
            SystemMessages::sysLogMsg(
                static::class,
                sprintf(
                    '[%s][PING-ERROR] %s from %s (%.3fs, PID:%d)',
                    $workerName,
                    $e->getMessage(),
                    $namespacePath,
                    $timeElapsed,
                    getmypid()
                ),
                LOG_WARNING
            );
        }
    }

    /**
     * Logs normal exit after operation
     */
    private function logNormalExit(): void
    {
        $workerName = basename(str_replace(self::LOG_NAMESPACE_SEPARATOR, '/', static::class));
        $timeElapsed = round(microtime(true) - $this->workerStartTime, 3);

        SystemMessages::sysLogMsg(
            static::class,
            sprintf(
                self::LOG_FORMAT_NORMAL_EXIT,
                $workerName,
                $timeElapsed,
                getmypid()
            ),
            LOG_DEBUG
        );
    }

    /**
     * Replies to a ping request from the worker
     *
     * @param array $parameters Request parameters
     * @return bool True if ping request was processed
     */
    public function replyOnPingRequest(array $parameters): bool
    {
        try {
            $pingTube = $this->makePingTubeName(static::class);
            if ($pingTube === $parameters['UserEvent']) {
                $this->am->UserEvent("{$pingTube}Pong", []);
                return true;
            }
        } catch (Throwable $e) {
            SystemMessages::sysLogMsg(
                static::class,
                "Ping reply failed: " . $e->getMessage(),
                LOG_WARNING
            );
        }
        return false;
    }

    /**
     * Generates the ping tube name for a worker class
     *
     * @param string $workerClassName Worker class name
     * @return string Generated ping tube name
     */
    public function makePingTubeName(string $workerClassName): string
    {
        return Text::camelize("ping_$workerClassName", '\\');
    }

    /**
     * Sets flag for forked process after pcntl_fork()
     */
    public function setForked(): void
    {
        $this->isForked = true;
    }

    /**
     * Destructor - ensures PID file is saved on object destruction
     */
    public function __destruct()
    {
        try {
            if ($this->workerState !== self::STATE_STOPPING) {
                $this->savePidFile();
            }
        } catch (Throwable $e) {
            SystemMessages::sysLogMsg(
                static::class,
                "Destructor failed: " . $e->getMessage(),
                LOG_WARNING
            );
        }
    }
}