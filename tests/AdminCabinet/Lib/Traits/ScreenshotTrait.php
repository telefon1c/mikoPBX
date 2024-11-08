<?php

namespace MikoPBX\Tests\AdminCabinet\Lib\Traits;

use RuntimeException;

/**
 * Trait ScreenshotTrait
 * Handles screenshot functionality in tests
 */
trait ScreenshotTrait
{
    /**
     * Take screenshot of current page state
     *
     * @param string $name Screenshot name
     * @return string Path to saved screenshot
     * @throws RuntimeException
     */
    protected function takeScreenshot(string $name): string
    {
        $screenshotDir = sprintf(
            '%s/%s',
            sys_get_temp_dir(),
            self::CONFIG['test']['screenshot_dir']
        );

        if (!is_dir($screenshotDir) && !mkdir($screenshotDir, 0777, true)) {
            throw new RuntimeException("Failed to create screenshot directory: $screenshotDir");
        }

        $filename = sprintf(
            '%s/%s_%s_%s.png',
            $screenshotDir,
            date('Y-m-d_H-i-s'),
            $this->getName(),
            preg_replace('/[^a-zA-Z0-9_-]/', '_', $name)
        );

        self::$driver->takeScreenshot($filename);
        self::annotate("Screenshot saved: $filename");

        return $filename;
    }

    /**
     * Take element screenshot
     *
     * @param string $xpath Element xpath
     * @param string $name Screenshot name
     * @return string Path to saved screenshot
     */
    protected function takeElementScreenshot(string $xpath, string $name): string
    {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            throw new RuntimeException("Element not found for screenshot: $xpath");
        }

        $this->scrollIntoView($element);
        return $this->takeScreenshot($name);
    }
}