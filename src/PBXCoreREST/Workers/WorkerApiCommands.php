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

namespace MikoPBX\PBXCoreREST\Workers;

use InvalidArgumentException;
use JsonException;
use MikoPBX\Common\Handlers\CriticalErrorsHandler;
use MikoPBX\Common\Providers\BeanstalkConnectionWorkerApiProvider;
use MikoPBX\Core\System\{BeanstalkClient, Configs\BeanstalkConf, Directories, Processes, SystemMessages};
use MikoPBX\Core\Workers\WorkerBase;
use MikoPBX\PBXCoreREST\Lib\ModulesManagementProcessor;
use MikoPBX\PBXCoreREST\Lib\PBXApiResult;
use MikoPBX\PBXCoreREST\Lib\PbxExtensionsProcessor;
use MikoPBX\PBXCoreREST\Lib\SystemManagementProcessor;
use RuntimeException;
use Throwable;
use function xdebug_break;

require_once 'Globals.php';


/**
 * The WorkerApiCommands class is responsible for handling API command requests from the frontend.
 *
 * It handles API command requests, delegates the processing to the appropriate processor classes,
 * and checks for restart requirements based on the received requests.
 *
 *
 * @package MikoPBX\PBXCoreREST\Workers
 */
class WorkerApiCommands extends WorkerBase
{
    /**
     * Maximum time to wait for child process (seconds)
     */
    private const int CHILD_PROCESS_TIMEOUT = 180;
    /** @var array Store all active child PIDs */
    private array $childPids = [];

    /**
     * Starts the worker.
     *
     * @param array $argv The command-line arguments passed to the worker.
     *
     * @return void
     */
    public function start(array $argv): void
    {
        $this->setupSignalHandlers();

        /** @var BeanstalkConnectionWorkerApiProvider $beanstalk */
        $beanstalk = $this->di->getShared(BeanstalkConnectionWorkerApiProvider::SERVICE_NAME);
        if ($beanstalk->isConnected() === false) {
            SystemMessages::sysLogMsg(self::class, 'Fail connect to beanstalkd...');
            sleep(2);
            return;
        }
        $beanstalk->subscribe($this->makePingTubeName(self::class), [$this, 'pingCallBack']);
        $beanstalk->subscribe(__CLASS__, [$this, 'prepareAnswer']);

        while ($this->needRestart === false) {
            $beanstalk->wait();
        }
    }

    /**
     * Process API request from frontend
     *
     * @param BeanstalkClient $message
     *
     */
    public function prepareAnswer(BeanstalkClient $message): void
    {
        // Use fork to run the callback in a separate process
        $pid = pcntl_fork();
        if ($pid === -1) {
            // Fork failed
            throw new \RuntimeException("Failed to fork a new process.");
        }

        if ($pid === 0) {
            try {
                // Child process
                $this->setForked();
                $this->processRequest($message);
            } catch (Throwable $e) {
                CriticalErrorsHandler::handleExceptionWithSyslog($e);
                exit(1); // Exit with error
            }
            exit(0);
        }

        // Parent process
        $this->trackChild($pid);

        try {
            $startTime = time();
            $status = 0;

            // Wait for child with timeout
            while (time() - $startTime < self::CHILD_PROCESS_TIMEOUT) {
                $res = pcntl_waitpid($pid, $status, WNOHANG);
                if ($res === -1) {
                    throw new RuntimeException("Failed to wait for child process");
                }
                if ($res > 0) {
                    // Child process completed
                    if (pcntl_wifexited($status)) {
                        $exitStatus = pcntl_wexitstatus($status);
                        if ($exitStatus !== 0) {
                            throw new RuntimeException("Child process failed with status: $exitStatus");
                        }
                        return;
                    }
                    if (pcntl_wifsignaled($status)) {
                        $signal = pcntl_wtermsig($status);
                        throw new RuntimeException("Child process terminated by signal: $signal");
                    }
                    return;
                }
                usleep(100000); // Sleep 100ms
            }
        } finally {
            $this->untrackChild($pid);
        }
        // Timeout reached
        posix_kill($pid, SIGTERM);
        throw new RuntimeException("Child process timed out");
    }

    /**
     * Process individual API request
     *
     * @param BeanstalkClient $message The message from beanstalk queue
     *
     * @throws JsonException If JSON parsing fails
     * @throws RuntimeException|Throwable If processor execution fails
     */
    private function processRequest(BeanstalkClient $message): void
    {
        $res = new PBXApiResult();
        $res->processor = __METHOD__;
        try {
            // Parse request JSON
            $request = $this->parseRequestJson($message);

            // Setup basic request parameters
            $async = (bool)($request['async'] ?? false);
            $processor = $this->resolveProcessor($request);

            $res->processor = $processor;

            // Old style, we can remove it in 2025
            if ($processor === 'modules') {
                $processor = PbxExtensionsProcessor::class;
            }

            // Handle debug mode if needed
            $this->handleDebugMode($request);

            // Process the request
            if (!method_exists($processor, 'callback')) {
                throw new RuntimeException("Unknown processor - {$processor}");
            }

            cli_set_process_title(__CLASS__ . '-' . $request['action']);

            SystemMessages::sysLogMsg(
                __CLASS__,
                json_encode($request, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
                LOG_DEBUG
            );

            // Execute request based on async flag
            if ($async) {
                $this->handleAsyncRequest($message, $request, $res);
            } else {
                $res = $processor::callback($request);
                $this->sendResponse($message, $res);
            }

            // Check if reload is needed after successful execution
            if ($res->success) {
                $this->checkNeedReload($request);
            }

        } catch (JsonException $e) {
            $this->handleError($res, "Invalid JSON in request: {$e->getMessage()}");
            $this->sendResponse($message, $res);
        } catch (InvalidArgumentException $e) {
            $this->handleError($res, "Invalid request parameters: {$e->getMessage()}");
            $this->sendResponse($message, $res);
        } catch (Throwable $e) {
            $this->handleError($res, CriticalErrorsHandler::handleExceptionWithSyslog($e));
            $this->sendResponse($message, $res);
            throw $e; // Re-throw for parent process to handle
        }
    }

    /**
     * Parse and validate request JSON
     *
     * @param BeanstalkClient $message
     * @return array
     * @throws JsonException
     */
    private function parseRequestJson(BeanstalkClient $message): array
    {
        $request = json_decode(
            $message->getBody(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        if (!is_array($request)) {
            throw new InvalidArgumentException('Request must be a JSON object');
        }

        return $request;
    }

    /**
     * Resolve processor class name
     *
     * @param array $request
     * @return string
     * @throws InvalidArgumentException
     */
    private function resolveProcessor(array $request): string
    {
        $processor = $request['processor'] ?? '';

        // Handle legacy 'modules' processor name
        if ($processor === 'modules') {
            return PbxExtensionsProcessor::class;
        }

        if (empty($processor)) {
            throw new InvalidArgumentException('Processor name is required');
        }

        return $processor;
    }

    /**
     * Start xdebug session if request called with special header: "X-Debug-The-Request"
     *
     * Add xdebug.start_with_request = trigger to xdebug.ini
     *
     * @examples
     * curl -X POST \
     * -H 'Content-Type: application/json' \
     * -H 'Cookie: XDEBUG_SESSION=PHPSTORM' \
     * -H 'X-Debug-The-Request: 1' \
     * -d '{"filename": "/storage/usbdisk1/mikopbx/tmp/mikopbx-2023.1.223-x86_64.img"}' \
     * http://127.0.0.1/pbxcore/api/system/upgrade
     *
     * Or add a header at any semantic API request
     * $.api({
     *      url: ...,
     *      on: 'now',
     *      method: 'POST',
     *      beforeXHR(xhr) {
     *          xhr.setRequestHeader ('X-Debug-The-Request', 1);
     *          return xhr;
     *      },
     *      ...
     * });
     */
    private function handleDebugMode(array $request): void
    {
        if (isset($request['debug']) && $request['debug'] === true && extension_loaded('xdebug')) {
            if (function_exists('xdebug_connect_to_client')) {
                if (xdebug_connect_to_client()) {
                    xdebug_break();
                }
            }
        }
    }

    /**
     * Handle asynchronous request execution
     *
     * @param BeanstalkClient $message
     * @param array $request
     * @param PBXApiResult $res
     */
    private function handleAsyncRequest(
        BeanstalkClient $message,
        array           $request,
        PBXApiResult    $res
    ): void
    {
        $res->success = true;
        $res->messages['info'][] = sprintf(
            'The async job %s starts in background, you will receive answer on %s nchan channel',
            $request['action'],
            $request['asyncChannelId']
        );

        $this->sendResponse($message, $res);
        $request['processor']::callback($request);
    }

    /**
     * Send response back through beanstalk
     *
     * @param BeanstalkClient $message
     * @param PBXApiResult $res
     * @throws RuntimeException
     */
    private function sendResponse(BeanstalkClient $message, PBXApiResult $res): void
    {
        try {
            $result = $res->getResult();
            $encodedResult = json_encode($result);

            if ($encodedResult === false) {
                $res->data = [];
                $res->messages['error'][] = 'Failed to encode response to JSON';
                $encodedResult = json_encode($res->getResult());
            }

            // Handle large responses
            if (strlen($encodedResult) > BeanstalkConf::JOB_DATA_SIZE_LIMIT) {
                $encodedResult = $this->handleLargeResponse($result);
            }

            $message->reply($encodedResult);

        } catch (Throwable $e) {
            throw new RuntimeException(
                "Failed to send response: {$e->getMessage()}",
                0,
                $e
            );
        }
    }

    /**
     * Handle large response by storing in temporary file
     *
     * @param array $result
     * @return string JSON encoded response with file reference
     * @throws RuntimeException
     */
    private function handleLargeResponse(array $result): string
    {
        $downloadCacheDir = Directories::getDir(Directories::WWW_DOWNLOAD_CACHE_DIR);

        // Generate unique filename using uniqid()
        $filenameTmp = sprintf(
            '%s/temp-%s_%s.data',
            $downloadCacheDir,
            __FUNCTION__,
            uniqid('', true)
        );

        // Check available disk space
        if (disk_free_space($downloadCacheDir) < strlen(serialize($result))) {
            throw new RuntimeException('Insufficient disk space for temporary file');
        }

        if (!file_put_contents($filenameTmp, serialize($result))) {
            throw new RuntimeException("Failed to write response to temporary file");
        }

        return json_encode([BeanstalkClient::RESPONSE_IN_FILE => $filenameTmp]);
    }

    /**
     * Checks if the module or worker needs to be reloaded.
     *
     * @param array $request
     */
    private function checkNeedReload(array $request): void
    {
        // Check if new code added from modules
        $restartActions = $this->getNeedRestartActions();
        foreach ($restartActions as $processor => $actions) {
            foreach ($actions as $action) {
                if (
                    $processor === $request['processor']
                    && $action === $request['action']
                ) {
                    $this->needRestart = true;
                    SystemMessages::sysLogMsg(
                        static::class,
                        "Service asked for restart all workers",
                        LOG_DEBUG
                    );
                    Processes::restartAllWorkers();
                    return;
                }
            }
        }
    }

    /**
     * Prepares array of processor => action depends restart this kind worker
     *
     * @return array
     */
    private function getNeedRestartActions(): array
    {
        return [
            SystemManagementProcessor::class => [
                'restoreDefault',
            ],
            ModulesManagementProcessor::class => [
                'enableModule',
                'disableModule',
                'uninstallModule',
            ],
        ];
    }

    /**
     * Handle error cases
     *
     * @param PBXApiResult $res
     * @param string $message
     */
    private function handleError(PBXApiResult $res, string $message): void
    {
        $res->success = false;
        $res->messages['error'][] = $message;
        $res->data = [];
    }

    /**
     * Track new child process
     */
    private function trackChild(int $pid): void
    {
        $this->childPids[$pid] = time();
    }

    /**
     * Register signal handlers
     */
    private function setupSignalHandlers(): void
    {
        pcntl_signal(SIGTERM, [$this, 'handleSignal']);
        pcntl_signal(SIGUSR1, [$this, 'handleSignal']);
        pcntl_signal(SIGINT, [$this, 'handleSignal']);
    }

    /**
     * Handle termination signals
     */
    public function handleSignal(int $signal): void
    {
        SystemMessages::sysLogMsg(
            self::class,
            "Received signal: $signal. Waiting for child processes..."
        );

        // Set flag to stop accepting new requests
        $this->needRestart = true;

        // Wait for all child processes to finish
        $this->waitForChildren();

        sleep (5);
        exit(0);
    }

    /**
     * Wait for all child processes to finish
     */
    private function waitForChildren(): void
    {

        while (!empty($this->childPids)) {
            foreach ($this->childPids as $pid => $startTime) {

                SystemMessages::sysLogMsg(
                    self::class,
                    "Child $pid CHECK STATUS"
                );
                // Check if process has finished
                $res = pcntl_waitpid($pid, $status, WNOHANG);

                if ($res === $pid) {
                    $this->untrackChild($pid);
                    continue;
                }

                // Check for timeout
                if (time() - $startTime > self::CHILD_PROCESS_TIMEOUT) {
                    SystemMessages::sysLogMsg(
                        self::class,
                        "Child $pid timed out, sending SIGTERM"
                    );
                    posix_kill($pid, SIGTERM);
                    $this->untrackChild($pid);
                }
            }
            sleep(1);
        }
    }

    /**
     * Remove finished child from tracking
     */
    private function untrackChild(int $pid): void
    {
        unset($this->childPids[$pid]);
    }
}

// Start a worker process
WorkerApiCommands::startWorker($argv ?? []);
