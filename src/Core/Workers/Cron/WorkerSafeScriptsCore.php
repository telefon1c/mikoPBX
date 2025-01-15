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

namespace MikoPBX\Core\Workers\Cron;

require_once 'Globals.php';

use MikoPBX\Common\Handlers\CriticalErrorsHandler;
use MikoPBX\Common\Providers\PBXConfModulesProvider;
use MikoPBX\Core\System\{BeanstalkClient, PBX, Processes, SystemMessages, Util};
use MikoPBX\Core\Workers\WorkerBase;
use MikoPBX\Core\Workers\WorkerBeanstalkdTidyUp;
use MikoPBX\Core\Workers\WorkerCallEvents;
use MikoPBX\Core\Workers\WorkerCdr;
use MikoPBX\Core\Workers\WorkerCheckFail2BanAlive;
use MikoPBX\Core\Workers\WorkerLogRotate;
use MikoPBX\Core\Workers\WorkerMarketplaceChecker;
use MikoPBX\Core\Workers\WorkerModelsEvents;
use MikoPBX\Core\Workers\WorkerNotifyByEmail;
use MikoPBX\Core\Workers\WorkerNotifyAdministrator;
use MikoPBX\Core\Workers\WorkerPrepareAdvice;
use MikoPBX\Core\Workers\WorkerRemoveOldRecords;
use MikoPBX\Modules\Config\SystemConfigInterface;
use MikoPBX\PBXCoreREST\Workers\WorkerApiCommands;
use RuntimeException;
use Throwable;

/**
 * Class WorkerSafeScriptsCore
 *
 * Core worker class responsible for managing and monitoring other worker processes.
 * Handles process startup, monitoring, and restart operations with safety mechanisms.
 *
 * @package MikoPBX\Core\Workers\Cron
 */
class WorkerSafeScriptsCore extends WorkerBase
{
    /**
     * Worker check types - defines how each worker type should be monitored
     */
    public const string CHECK_BY_BEANSTALK = 'checkWorkerBeanstalk';
    public const string CHECK_BY_AMI = 'checkWorkerAMI';
    public const string CHECK_BY_PID_NOT_ALERT = 'checkPidNotAlert';


    /**
     * Configuration constants
     */
    private const int MAX_WORKER_START_TIME = 30; // Maximum time in seconds for worker startup
    private const int BATCH_SIZE = 5; // Number of workers to process in one batch
    private const int CHECK_INTERVAL_MS = 100000; // Sleep interval between checks (100ms)
    private const int MAX_AMI_RETRIES = 10; // Maximum retries for AMI operations
    private const int WORKER_TIMEOUT_SECONDS = 10; // Timeout for individual worker operations
    private const string LOCK_FILE_DIR = '/var/run/'; // Directory for process lock files

    /**
     * Sets up signal handlers for timeout management
     */
    private function setupSignalHandlers(): void
    {
        pcntl_signal(SIGALRM, function () {
            SystemMessages::sysLogMsg(__CLASS__, "Operation timeout exceeded", LOG_WARNING);
            exit(1);
        });
        pcntl_signal_dispatch();
    }

    /**
     * Resets signal handlers to their default state
     */
    private function resetSignalHandlers(): void
    {
        pcntl_alarm(0);
        pcntl_signal(SIGALRM, SIG_DFL);
    }

    /**
     * Logs slow operations that exceed the timeout threshold
     *
     * @param string $workerClassName Name of the worker class being monitored
     * @param float $startTime Start time of the operation
     */
    private function logSlowOperation(string $workerClassName, float $startTime): void
    {
        $timeElapsedSecs = round(microtime(true) - $startTime, 2);
        if ($timeElapsedSecs > self::WORKER_TIMEOUT_SECONDS) {
            SystemMessages::sysLogMsg(
                __METHOD__,
                "WARNING: Service $workerClassName processed more than $timeElapsedSecs seconds"
            );
        }
    }

    /**
     * Restarts all registered workers with timeout control and process management.
     * Uses locking mechanism to prevent concurrent restart operations.
     * Processes workers in batches to avoid system overload.
     *
     * @throws RuntimeException If unable to fork or terminate child processes
     * @throws Throwable From worker restart operations
     * @return void
     */
    public function restart(): void
    {
        $this->setupSignalHandlers();

        // Acquire lock for restart operation
        $lockFile = $this->acquireLock('restart');
        if ($lockFile === null) {
            SystemMessages::sysLogMsg(__CLASS__, "Another restart operation is already running", LOG_WARNING);
            return;
        }

        try {
            // Prepare the list of workers to be restarted
            $arrWorkers = $this->prepareWorkersList();
            $totalWorkers = 0;
            foreach ($arrWorkers as $workers) {
                $totalWorkers += count($workers);
            }

            $childPids = [];
            $currentBatch = [];

            // Set alarm for overall timeout
            pcntl_alarm(self::MAX_WORKER_START_TIME);

            // Process workers in batches
            foreach ($arrWorkers as $workersWithCurrentType) {
                foreach ($workersWithCurrentType as $worker) {
                    $currentBatch[] = $worker;

                    if (count($currentBatch) >= self::BATCH_SIZE) {
                        $this->processBatch($currentBatch, $childPids);
                        $currentBatch = [];
                    }
                }
            }

            // Process any remaining workers
            if (!empty($currentBatch)) {
                $this->processBatch($currentBatch, $childPids);
            }

            // Wait for all children to complete
            $successCount = $this->waitForChildren($childPids);

            SystemMessages::sysLogMsg(
                __CLASS__,
                "Restart operation completed. Successfully restarted {$successCount} of {$totalWorkers} workers",
                LOG_INFO
            );

        } catch (Throwable $e) {
            SystemMessages::sysLogMsg(
                __CLASS__,
                "Restart operation failed: " . $e->getMessage(),
                LOG_ERR
            );
            CriticalErrorsHandler::handleExceptionWithSyslog($e);
            throw $e;
        } finally {
            // Clean up resources
            if (file_exists($lockFile)) {
                unlink($lockFile);
            }
            $this->resetSignalHandlers();
        }
    }

    /**
     * Starts or checks all workers.
     * Implements batch processing and timeout control similar to restart operation.
     *
     * @param array $argv Command-line arguments passed to the worker
     * @throws Throwable From worker operations
     * @return void
     */
    public function start(array $argv): void
    {
        $this->setupSignalHandlers();
        $lockFile = $this->acquireLock('start');
        if ($lockFile === null) {
            SystemMessages::sysLogMsg(__CLASS__, "Another instance is already running", LOG_WARNING);
            return;
        }

        try {
            // Wait for system to be fully booted
            PBX::waitFullyBooted();

            $arrWorkers = $this->prepareWorkersList();
            $childPids = [];
            $currentBatch = [];

            pcntl_alarm(self::MAX_WORKER_START_TIME);

            // Process workers in batches by type
            foreach ($arrWorkers as $workerType => $workers) {
                foreach ($workers as $worker) {
                    $currentBatch[] = ['type' => $workerType, 'worker' => $worker];
                    if (count($currentBatch) >= self::BATCH_SIZE) {
                        $this->processStartBatch($currentBatch, $childPids);
                        $currentBatch = [];
                    }
                }
            }

            // Process remaining workers
            if (!empty($currentBatch)) {
                $this->processStartBatch($currentBatch, $childPids);
            }

            $this->waitForChildren($childPids);

        } catch (Throwable $e) {
            CriticalErrorsHandler::handleExceptionWithSyslog($e);
            throw $e;
        } finally {
            if (file_exists($lockFile)) {
                unlink($lockFile);
            }
            $this->resetSignalHandlers();
        }
    }

    /**
     * Processes a batch of workers for starting operation.
     *
     * @param array $batch Array of worker configurations to process
     * @param array $childPids Reference to array storing child PIDs
     * @throws RuntimeException If fork fails
     */
    private function processStartBatch(array $batch, array &$childPids): void
    {
        foreach ($batch as $workerConfig) {
            $pid = pcntl_fork();
            if ($pid === -1) {
                throw new RuntimeException("Failed to fork process for worker: {$workerConfig['worker']}");
            }
            if ($pid === 0) {
                // Child process
                try {
                    $this->setForked();
                    $this->checkWorkerByType($workerConfig['type'], $workerConfig['worker']);
                    exit(0);
                } catch (Throwable $e) {
                    CriticalErrorsHandler::handleExceptionWithSyslog($e);
                    exit(1);
                }
            }
            // Parent process - store child PID
            $childPids[] = $pid;
        }
    }
    /**
     * Processes a batch of workers for restart operation.
     *
     * @param array $batch Array of worker class names to restart
     * @param array $childPids Reference to array storing child PIDs
     * @throws RuntimeException If fork fails
     */
    private function processBatch(array $batch, array &$childPids): void
    {
        foreach ($batch as $worker) {
            $pid = pcntl_fork();
            if ($pid === -1) {
                throw new RuntimeException("Failed to fork process for worker: $worker");
            }
            if ($pid === 0) {
                // Child process
                try {
                    $this->setForked();
                    SystemMessages::sysLogMsg(
                        __CLASS__,
                        "Restarting worker: $worker",
                        LOG_DEBUG
                    );
                    $this->restartWorker($worker);
                    exit(0);
                } catch (Throwable $e) {
                    CriticalErrorsHandler::handleExceptionWithSyslog($e);
                    exit(1);
                }
            }
            // Parent process - store child PID
            $childPids[] = $pid;
        }
    }

    /**
     * Prepares the list of workers to start and restart.
     * Collects both core workers and module workers.
     *
     * @return array Associative array of workers grouped by check type
     */
    private function prepareWorkersList(): array
    {
        // Initialize the workers' list with core workers
        $arrWorkers = [
            self::CHECK_BY_AMI => [],
            self::CHECK_BY_BEANSTALK => [
                WorkerApiCommands::class,
                WorkerCdr::class,
                WorkerCallEvents::class,
                WorkerModelsEvents::class,
                WorkerNotifyByEmail::class,
                WorkerNotifyAdministrator::class,
            ],
            self::CHECK_BY_PID_NOT_ALERT => [
                WorkerMarketplaceChecker::class,
                WorkerBeanstalkdTidyUp::class,
                WorkerCheckFail2BanAlive::class,
                WorkerLogRotate::class,
                WorkerRemoveOldRecords::class,
                WorkerPrepareAdvice::class
            ],
        ];

        // Get and merge module workers
        $arrModulesWorkers = PBXConfModulesProvider::hookModulesMethod(SystemConfigInterface::GET_MODULE_WORKERS);
        $arrModulesWorkers = array_merge(...array_values($arrModulesWorkers));

        // Add module workers to appropriate check types
        if (!empty($arrModulesWorkers)) {
            foreach ($arrModulesWorkers as $moduleWorker) {
                $arrWorkers[$moduleWorker['type']][] = $moduleWorker['worker'];
            }
        }

        return $arrWorkers;
    }

    /**
     * Acquires a lock for the worker process.
     * Prevents multiple instances of the same operation from running simultaneously.
     *
     * @param string $operation The operation name ('start' or 'restart')
     * @return string|null Path to the lock file if lock was acquired, null otherwise
     */
    private function acquireLock(string $operation): ?string
    {
        $lockFile = self::LOCK_FILE_DIR . "worker_safe_scripts_{$operation}.lock";
        $fp = fopen($lockFile, 'w+');

        if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) {
            return null;
        }

        return $lockFile;
    }

    /**
     * Routes worker check to appropriate method based on worker type.
     *
     * @param string $type Type of check to perform
     * @param string $worker Worker class name to check
     */
    private function checkWorkerByType(string $type, string $worker): void
    {
        switch ($type) {
            case self::CHECK_BY_BEANSTALK:
                $this->checkWorkerBeanstalk($worker);
                break;
            case self::CHECK_BY_PID_NOT_ALERT:
                $this->checkPidNotAlert($worker);
                break;
            case self::CHECK_BY_AMI:
                $this->checkWorkerAMI($worker);
                break;
        }
    }

    /**
     * Restarts a specific worker by class name.
     *
     * @param string $workerClassName The class name of the worker to restart
     */
    public function restartWorker(string $workerClassName): void
    {
        Processes::processPHPWorker($workerClassName, 'start', 'restart');
    }


    /**
     * Waits for child processes to complete with timeout control.
     *
     * @param array $pids Array of process IDs to wait for
     * @return int Number of successfully completed processes
     */
    private function waitForChildren(array $pids): int
    {
        $successCount = 0;
        $timeout = time() + self::MAX_WORKER_START_TIME;
        $remainingPids = $pids;

        while (!empty($remainingPids) && time() < $timeout) {
            foreach ($remainingPids as $i => $pid) {
                $res = pcntl_waitpid($pid, $status, WNOHANG);
                if ($res === $pid) {
                    // Process completed
                    unset($remainingPids[$i]);
                    if (pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0) {
                        $successCount++;
                    }
                } elseif ($res === -1) {
                    // Error or process doesn't exist
                    unset($remainingPids[$i]);
                }
            }
            if (!empty($remainingPids)) {
                usleep(self::CHECK_INTERVAL_MS);
            }
        }

        // Kill remaining processes that exceeded timeout
        foreach ($remainingPids as $pid) {
            SystemMessages::sysLogMsg(
                __CLASS__,
                "Worker process $pid exceeded timeout, terminating",
                LOG_WARNING
            );
            posix_kill($pid, SIGTERM);
        }

        return $successCount;
    }

    /**
     * Checks a worker via Beanstalk and restarts it if it is unresponsive.
     * Uses Beanstalk queue to send ping and check workers.
     *
     * @param string $workerClassName The class name of the worker.
     *
     * @return void
     */
    public function checkWorkerBeanstalk(string $workerClassName): void
    {
        // Check if the worker is alive. If not, restart it.
        // The check is done by pinging the worker using a Beanstalk queue.
        try {
            $start = microtime(true);
            $WorkerPID = Processes::getPidOfProcess($workerClassName);
            $result = false;
            if ($WorkerPID !== '') {
                // Ping the worker via Beanstalk queue.
                SystemMessages::sysLogMsg(__METHOD__, "Service $workerClassName is alive. Sending ping request.", LOG_DEBUG);
                $queue = new BeanstalkClient($this->makePingTubeName($workerClassName));
                [$result] = $queue->sendRequest('ping', 5, 1);
                SystemMessages::sysLogMsg(__METHOD__, "Service $workerClassName answered $result", LOG_DEBUG);

            }
            if (false === $result) {
                Processes::processPHPWorker($workerClassName);
                SystemMessages::sysLogMsg(__METHOD__, "Service $workerClassName started.", LOG_NOTICE);
            }
            $timeElapsedSecs = round(microtime(true) - $start, 2);
            if ($timeElapsedSecs > 10) {
                SystemMessages::sysLogMsg(
                    __METHOD__,
                    "WARNING: Service $workerClassName processed more than $timeElapsedSecs seconds"
                );
            }
        } catch (Throwable $e) {
            CriticalErrorsHandler::handleExceptionWithSyslog($e);
        }
    }

    /**
     * Checks the worker by PID and restarts it if it has terminated.
     *
     * @param string $workerClassName The class name of the worker.
     *
     * @return void
     */
    public function checkPidNotAlert(string $workerClassName): void
    {
        // Check if the worker is alive based on its PID. If not, restart it.
        $start = microtime(true);
        $WorkerPID = Processes::getPidOfProcess($workerClassName);
        $result = ($WorkerPID !== '');
        if (false === $result) {
            Processes::processPHPWorker($workerClassName);
        }
        $timeElapsedSecs = round(microtime(true) - $start, 2);
        if ($timeElapsedSecs > 10) {
            SystemMessages::sysLogMsg(
                __CLASS__,
                "WARNING: Service $workerClassName processed more than $timeElapsedSecs seconds"
            );
        }
    }

    /**
     * Checks the worker by PID and restarts it if it has terminated.
     * Uses AMI UserEvent to send ping and check workers.
     *
     * @param string $workerClassName The class name of the worker.
     *
     * @return void
     */
    public function checkWorkerAMI(string $workerClassName): void
    {
        $start = microtime(true);
        $attempts = 0;

        while ($attempts < self::MAX_AMI_RETRIES) {
            try {
                $WorkerPID = Processes::getPidOfProcess($workerClassName);
                if ($WorkerPID === '') {
                    break;
                }

                $am = Util::getAstManager();
                if ($am->pingAMIListener($this->makePingTubeName($workerClassName))) {
                    return;
                }

                SystemMessages::sysLogMsg(__METHOD__, 'Restarting...', LOG_ERR);
                Processes::processPHPWorker($workerClassName);
                sleep(1);
                $attempts++;

            } catch (Throwable $e) {
                CriticalErrorsHandler::handleExceptionWithSyslog($e);
                break;
            }
        }

        $this->logSlowOperation($workerClassName, $start);
    }
}

// Start a worker process
$workerClassname = WorkerSafeScriptsCore::class;
try {

    // If command-line arguments are provided, set the process title and check for active processes.
    if (isset($argv) && count($argv) > 1) {
        cli_set_process_title("$workerClassname $argv[1]");
        $activeProcesses = Processes::getPidOfProcess("$workerClassname $argv[1]", posix_getpid());
        if (!empty($activeProcesses)) {
            SystemMessages::sysLogMsg($workerClassname, "WARNING: Other started process $activeProcesses with parameter: $argv[1] is working now...", LOG_DEBUG);
            return;
        }
        $worker = new $workerClassname();

        // Depending on the command-line argument, start or restart the worker.
        if ($argv[1] === 'start') {
            $worker->start($argv);
            SystemMessages::sysLogMsg($workerClassname, "Normal exit after start ended", LOG_DEBUG);
        } elseif ($argv[1] === 'restart' || $argv[1] === 'reload') {
            $worker->restart();
            SystemMessages::sysLogMsg($workerClassname, "Normal exit after restart ended", LOG_DEBUG);
        }
    }
} catch (Throwable $e) {
    // If an exception is thrown, log it.
    CriticalErrorsHandler::handleExceptionWithSyslog($e);
}