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

namespace MikoPBX\Tests\AdminCabinet\Lib;

use Exception;
use RuntimeException;
use Facebook\WebDriver\Exception\NoSuchElementException;
use Facebook\WebDriver\Interactions\WebDriverActions;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverElement;
use Facebook\WebDriver\WebDriverExpectedCondition;
use MikoPBX\Tests\AdminCabinet\Tests\LoginTrait;

/**
 * Enum for BrowserStack actions
 */
enum BrowserStackAction: string
{
    case ANNOTATE = 'annotate';
    case SET_SESSION_STATUS = 'setSessionStatus';
    case SET_SESSION_NAME = 'setSessionName';
}

class MikoPBXTestsBase extends BrowserStackTest
{
    use LoginTrait;

    protected const WAIT_TIMEOUT = 10;
    protected const WAIT_INTERVAL = 500;
    protected const DEFAULT_DELAY = 1;
    protected const SCROLL_BEHAVIOR = 'instant';
    protected const SCREENSHOT_DIR = 'test-screenshots';


    /**
     * Common input types for forms
     */
    protected const INPUT_TYPES = [
        'text' => 'text',
        'password' => 'password',
        'number' => 'number',
        'hidden' => 'hidden',
        'search' => 'search'
    ];

    /**
     * Execute action with retry logic
     */
    protected function executeWithRetry(callable $action, int $maxAttempts = 3): mixed
    {
        $lastException = null;
        for ($i = 0; $i < $maxAttempts; $i++) {
            try {
                return $action();
            } catch (Exception $e) {
                $lastException = $e;
                $this->waitForAjax();
                sleep(self::DEFAULT_DELAY);
            }
        }
        throw $lastException ?? new RuntimeException('Action failed after retries');
    }

    /**
     * Send command to BrowserStack
     */
    protected function sendBrowserStackCommand(
        BrowserStackAction $action,
        array $arguments
    ): void {
        $data = [
            'action' => $action->value,
            'arguments' => $arguments
        ];
        $message = 'browserstack_executor: ' . json_encode($data, JSON_PRETTY_PRINT);
        self::$driver->executeScript($message);
    }

    /**
     * Add annotation in BrowserStack
     */
    public static function annotate(string $text, string $level = 'info'): void
    {
        self::$driver->executeScript(
            'browserstack_executor: ' . json_encode([
                'action' => BrowserStackAction::ANNOTATE->value,
                'arguments' => [
                    'level' => $level,
                    'data' => $text
                ]
            ])
        );
    }

    /**
     * Set BrowserStack session status
     */
    public static function setSessionStatus(string $text, string $status = 'failed'): void
    {
        self::$driver->executeScript(
            'browserstack_executor: ' . json_encode([
                'action' => BrowserStackAction::SET_SESSION_STATUS->value,
                'arguments' => [
                    'status' => $status,
                    'reason' => substr($text, 0, 256)
                ]
            ])
        );
    }





    /**
     * Wait for AJAX requests to complete
     */
    protected function waitForAjax(): void
    {
        self::annotate("Test action: Waiting for AJAX");
        $this->executeWithRetry(function () {
            return (bool)self::$driver->executeScript("return window.jQuery && jQuery.active == 0");
        });
    }

    /**
     * Find element safely without throwing exception
     */
    protected function findElementSafely(string $xpath): ?WebDriverElement
    {
        try {
            return self::$driver->findElement(WebDriverBy::xpath($xpath));
        } catch (NoSuchElementException) {
            return null;
        }
    }

    /**
     * Wait for element presence
     */
    protected function waitForElement(string $xpath, int $timeout = self::WAIT_TIMEOUT): WebDriverElement
    {
        return self::$driver->wait($timeout, self::WAIT_INTERVAL)->until(
            WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::xpath($xpath))
        );
    }

    /**
     * Scroll element into view
     */
    protected function scrollIntoView(WebDriverElement $element, string $block = 'center'): void
    {
        self::$driver->executeScript(
            "arguments[0].scrollIntoView({block: '$block', behavior: '" . self::SCROLL_BEHAVIOR . "'})",
            [$element]
        );
    }

    /**
     * Handle action errors
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
        $this->fail("$errorMessage\nScreenshot saved at: $screenshotPath");
    }

    /**
     * Take screenshot
     */
    protected function takeScreenshot(string $name): string
    {
        $screenshotDir = sys_get_temp_dir() . '/test-screenshots';
        if (!is_dir($screenshotDir) && !mkdir($screenshotDir, 0777, true)) {
            throw new RuntimeException("Failed to create screenshot directory");
        }

        $filename = sprintf(
            '%s/%s_%s_%s.png',
            $screenshotDir,
            date('Y-m-d_H-i-s'),
            $this->getName(),
            $name
        );

        self::$driver->takeScreenshot($filename);
        return $filename;
    }

    protected function logTestAction(string $action, array $context = []): void
    {
        $message = "Test action: $action";
        if ($context) {
            $message .= " Context: " . json_encode($context);
        }
        self::annotate($message);
    }

    /**
     * Fails a test with the given message.
     *
     *
     * @psalm-return never-return
     */
    public static function fail(string $message = ''): void
    {
        self::setSessionStatus($message);
        parent::fail($message);
    }

    /**
     * Update current session name
     * @param string $name
     * @return void
     */
    public static function setSessionName(string $name): void
    {

        // Create an associative array with the structure you want to encode as JSON
        $data = [
            'action' => 'setSessionName',
            'arguments' => [
                'name' => $name
            ]
        ];

        // Encode the array as a JSON string
        $message = 'browserstack_executor: ' . json_encode($data, JSON_PRETTY_PRINT);

        // Execute the script with the encoded message
        // Temporary disable because of many problems on BrowserStack
        self::$driver->executeScript($message);
    }

    /**
     * Select dropdown menu item
     *
     * @param $name  string menu name identifier
     * @param $value string menu value for select
     *
     */
    protected function selectDropdownItem(string $name, string $value): void
    {
        $this->logTestAction("Select dropdown", ['name' => $name, 'value' => $value]);

        try {
            $this->executeWithRetry(function () use ($name, $value) {
                $dropdown = $this->findAndClickDropdown($name);
                $this->waitForAjax();
                $this->fillDropdownSearch($name, $value);
                $this->selectDropdownValue($value);
            });
        } catch (Exception $e) {
            $this->handleActionError('select dropdown item', "$name with value $value", $e);
        }
    }

    /**
     * Find and click dropdown
     */
    private function findAndClickDropdown(string $name): WebDriverElement
    {
        $xpath = sprintf(
            '//select[@name="%s"]/ancestor::div[contains(@class, "ui") and contains(@class ,"dropdown")] | //div[@id="%s" and contains(@class, "ui") and contains(@class ,"dropdown")]',
            $name,
            $name
        );
        $dropdown = $this->waitForElement($xpath);
        $this->scrollIntoView($dropdown);
        $dropdown->click();
        return $dropdown;
    }

    /**
     * Fill dropdown search field
     */
    private function fillDropdownSearch(string $name, string $value): void
    {
        $xpath = sprintf(
            '//select[@name="%s"]/ancestor::div[contains(@class, "dropdown")]/input[contains(@class,"search")] | //div[@id="%s"]/input[contains(@class,"search")]',
            $name,
            $name
        );

        if ($searchInput = $this->findElementSafely($xpath)) {
            $this->scrollIntoView($searchInput);
            $searchInput->click();
            $searchInput->clear();
            $searchInput->sendKeys($value);
        }
    }

    /**
     * Select dropdown value
     */
    private function selectDropdownValue(string $value): void
    {
        $xpath = sprintf(
            '//div[contains(@class, "menu") and contains(@class ,"visible")]/div[@data-value="%s"]',
            $value
        );
        $menuItem = $this->waitForElement($xpath);
        $menuItem->click();
    }




    /**
     * Assert that menu item selected
     *
     * @param      $name         string menu name
     * @param      $checkedValue string checked value
     * @param bool $skipIfNotExist
     */
    protected function assertMenuItemSelected(string $name, string $checkedValue, bool $skipIfNotExist = false): void
    {
        $xpath = sprintf('//select[@name="%s"]/option[@selected="selected"]', $name);
        $selected = $this->findElementSafely($xpath);

        if (!$selected && !$skipIfNotExist) {
            $this->fail("Menu item $name not found");
        }

        if ($selected) {
            $currentValue = $selected->getAttribute('value');
            $this->assertEquals(
                $checkedValue,
                $currentValue,
                "Menu item $name check failed: expected $checkedValue, got $currentValue"
            );
        }
    }

    /**
     * Assert that menu item not selected
     *
     * @param      $name         string menu name
     */
    protected function assertMenuItemNotSelected(string $name): void
    {
        $xpath = sprintf('//select[@name="%s"]/option[@selected="selected"]', $name);
        $this->assertElementNotFound(WebDriverBy::xpath($xpath));
    }

    /**
     * Assert that menu item not found on the page
     *
     * @param $by
     */
    protected function assertElementNotFound($by): void
    {
        $elements = self::$driver->findElements($by);
        if (count($elements) > 0) {
            $this->fail("Unexpectedly element was found by " . $by->getValue());
        }
        $this->assertTrue(true);
    }

    /**
     * Change textarea with name $name value to $value
     *
     * @param string $name
     * @param string $value
     * @param bool $skipIfNotExist
     */
    protected function changeTextAreaValue(string $name, string $value, bool $skipIfNotExist = false): void
    {
        $this->logTestAction("Change textarea", ['name' => $name, 'value' => $value]);

        try {
            $xpath = sprintf('//textarea[@name="%s"]', $name);
            $textArea = $this->findElementSafely($xpath);

            if (!$textArea && !$skipIfNotExist) {
                throw new RuntimeException("Textarea $name not found");
            }

            if ($textArea) {
                $this->scrollIntoView($textArea);
                $textArea->click();
                $textArea->clear();
                $textArea->sendKeys($value);
            }
        } catch (Exception $e) {
            $this->handleActionError('change textarea value', $name, $e);
        }
    }

    /**
     * Assert that textArea value is equal
     *
     * @param string $name textArea name
     * @param string $checkedValue checked value
     */
    protected function assertTextAreaValueIsEqual(string $name, string $checkedValue): void
    {
        $xpath = '//textarea[@name="' . $name . '"]';
        $textAreaItem = self::$driver->findElement(WebDriverBy::xpath($xpath));
        $currentValue = $textAreaItem->getAttribute('value');
        $message = "{$name} check failure, because {$checkedValue} != {$currentValue}";
        $this->assertEquals($checkedValue, $currentValue, $message);
    }

    /**
     * If file filed with $name exists on the page, it value will be changed on $value
     *
     * @param string $name
     * @param string $value
     * @param bool $skipIfNotExist
     */
    protected function changeFileField(string $name, string $value, bool $skipIfNotExist = false): void
    {
        self::annotate("Test action: Change file field $name with value $value");
        $xpath = '//input[@name="' . $name . '" and (@type = "file")]';
        $inputItems = self::$driver->findElements(WebDriverBy::xpath($xpath));
        foreach ($inputItems as $inputItem) {
            $inputItem->sendKeys($value);
        }
        if (!$skipIfNotExist && count($inputItems) === 0) {
            $this->fail('Not found input with type FILE and with name ' . $name . ' in changeFileField' . PHP_EOL);
        }
    }

    /**
     * Assert that input field with name $name value is equal to $checkedValue
     *
     * @param string $name
     * @param string $checkedValue
     * @param bool $skipIfNotExist
     */
    protected function assertInputFieldValueEqual(string $name, string $checkedValue, bool $skipIfNotExist = false): void
    {
        $xpath = '//input[@name="' . $name . '" and (@type="text" or @type="number" or @type="password" or @type="hidden")]';
        $inputItems = self::$driver->findElements(WebDriverBy::xpath($xpath));
        foreach ($inputItems as $inputItem) {
            $currentValue = $inputItem->getAttribute('value');
            $message = "input field: '{$name}' check failure, because {$checkedValue} != {$currentValue}";
            $this->assertEquals($checkedValue, $currentValue, $message);
        }
        if (!$skipIfNotExist && count($inputItems) === 0) {
            $this->fail('Not found input with name ' . $name . ' in assertInputFieldValueEqual' . PHP_EOL);
        }
    }

    /**
     * Change checkbox state
     */
    protected function changeCheckBoxState(string $name, bool $enabled, bool $skipIfNotExist = false): void
    {
        $this->logTestAction("Change checkbox", ['name' => $name, 'enabled' => $enabled]);

        try {
            $xpath = sprintf('//input[@name="%s" and @type="checkbox"]', $name);
            $checkbox = $this->findElementSafely($xpath);

            if (!$checkbox && !$skipIfNotExist) {
                throw new RuntimeException("Checkbox $name not found");
            }

            if ($checkbox && $checkbox->isSelected() !== $enabled) {
                $parentXpath = $xpath . '/parent::div';
                $parentElement = self::$driver->findElement(WebDriverBy::xpath($parentXpath));
                $this->scrollIntoView($parentElement);
                $parentElement->click();
            }
        } catch (Exception $e) {
            $this->handleActionError('change checkbox state', $name, $e);
        }
    }

    /**
     * Assert that checkBox state is equal to the $enabled if checkbox with the $name exist on the page
     *
     * @param string $name checkBox name
     * @param bool $enabled checked state
     * @param bool $skipIfNotExist
     */
    protected function assertCheckBoxStageIsEqual(string $name, bool $enabled, bool $skipIfNotExist = false): void
    {
        $xpath = '//input[@name="' . $name . '" and @type="checkbox"]';
        $checkBoxItems = self::$driver->findElements(WebDriverBy::xpath($xpath));
        foreach ($checkBoxItems as $checkBoxItem) {
            if ($enabled) {
                $this->assertTrue($checkBoxItem->isSelected(), "{$name} must be checked" . PHP_EOL);
            } else {
                $this->assertFalse($checkBoxItem->isSelected(), "{$name} must be unchecked" . PHP_EOL);
            }
        }
        if (!$skipIfNotExist && count($checkBoxItems) === 0) {
            $this->fail('Not found checkbox with name ' . $name . ' in assertCheckBoxStageIsEqual' . PHP_EOL);
        }
    }

    /**
     * Submit form
     */
    protected function submitForm(string $formId): void
    {
        $this->logTestAction("Submit form", ['id' => $formId]);

        try {
            $this->executeWithRetry(function () use ($formId) {
                $xpath = sprintf('//form[@id="%s"]//ancestor::div[@id="submitbutton"]', $formId);
                $button = $this->waitForElement($xpath);
                $this->scrollIntoView($button);
                $button->click();
                $this->waitForAjax();

                // Wait for button to be enabled again
                self::$driver->wait(self::WAIT_TIMEOUT, self::WAIT_INTERVAL)->until(
                    function () use ($xpath) {
                        return self::$driver->findElement(WebDriverBy::xpath($xpath))->isEnabled();
                    }
                );
            });
        } catch (Exception $e) {
            $this->handleActionError('submit form', $formId, $e);
        }
    }

    /**
     * Fill form with data
     */
    protected function fillForm(array $data): void
    {
        $this->logTestAction("Fill form", $data);

        foreach ($data as $name => $value) {
            match (true) {
                $this->isDropdown($name) => $this->selectDropdownItem($name, $value),
                $this->isCheckbox($name) => $this->changeCheckBoxState($name, (bool)$value),
                $this->isTextArea($name) => $this->changeTextAreaValue($name, (string)$value),
                default => $this->changeInputField($name, (string)$value)
            };
        }
    }

    protected function getFormData(array $fields): array
    {
        $data = [];
        foreach ($fields as $field) {
            $element = $this->findElementSafely("//input[@name='$field'] | //textarea[@name='$field'] | //select[@name='$field']");
            if ($element) {
                $data[$field] = $element->getAttribute('value');
            }
        }
        return $data;
    }

    /**
     * Click on the left sidebar menu item
     *
     * @param string $href
     */
    protected function clickSidebarMenuItemByHref(string $href): void
    {
        $this->logTestAction("Click sidebar menu", ['href' => $href]);

        try {
            $xpath = sprintf(
                '//div[@id="sidebar-menu"]//ancestor::a[contains(@class, "item") and contains(@href ,"%s")]',
                $href
            );

            $menuItem = $this->waitForElement($xpath);
            $this->scrollIntoView($menuItem);
            $menuItem->click();
            $this->waitForAjax();
        } catch (Exception $e) {
            $this->handleActionError('click sidebar menu item', $href, $e);
        }
    }

    /**
     * Find modify button on row with text $text and click it
     *
     * @param string $text
     */
    protected function clickModifyButtonOnRowWithText(string $text): void
    {
        self::annotate("Test action: Click modify button with text=$text");
        $xpath = ('//td[contains(text(),"' . $text . '")]/parent::tr[contains(@class, "row")]//a[contains(@href,"modify")]');
        try {
            $tableButtonModify = self::$driver->findElement(WebDriverBy::xpath($xpath));
            $actions = new WebDriverActions(self::$driver);
            $actions->moveToElement($tableButtonModify);
            $actions->perform();
            $tableButtonModify->click();
            $this->waitForAjax();
        } catch (NoSuchElementException $e) {
            $this->fail('Not found row with text=' . $text . ' on this page' . PHP_EOL);
        } catch (Exception $e) {
            $this->fail('Unknown error ' . $e->getMessage() . PHP_EOL);
        }
    }

    /**
     * Find modify button on row with id $text and click it
     *
     * @param string $id
     */
    protected function clickModifyButtonOnRowWithID(string $id): void
    {
        self::annotate("Test action: Click modify button with id=$id");
        $xpath = ('//tr[contains(@class, "row") and @id="' . $id . '"]//a[contains(@href,"modify")]');
        try {
            $tableButtonModify = self::$driver->findElement(WebDriverBy::xpath($xpath));
            $actions = new WebDriverActions(self::$driver);
            $actions->moveToElement($tableButtonModify);
            $actions->perform();
            $tableButtonModify->click();
            $this->waitForAjax();
        } catch (NoSuchElementException $e) {
            $this->fail('Not found row with id=' . $id . ' on this page' . PHP_EOL);
        } catch (Exception $e) {
            $this->fail('Unknown error ' . $e->getMessage() . PHP_EOL);
        }
    }

    /**
     * Find modify button on row with text $text and click it
     *
     * @param string $text
     */
    protected function clickDeleteButtonOnRowWithText(string $text): void
    {
        self::annotate("Test action: Click delete button with text=$text");
        $xpath = ('//td[contains(text(),"' . $text . '")]/ancestor::tr[contains(@class, "row")]//a[contains(@href,"delete")]');
        try {
            $deleteButtons = self::$driver->findElements(WebDriverBy::xpath($xpath));
            foreach ($deleteButtons as $deleteButton) {
                $deleteButton->click();
                sleep(1);
                $deleteButton->click();
            }
            $this->waitForAjax();
        } catch (NoSuchElementException $e) {
            echo('Not found row with text=' . $text . ' on this page in clickDeleteButtonOnRowWithText' . PHP_EOL);
        } catch (Exception $e) {
            $this->fail('Unknown error ' . $e->getMessage() . PHP_EOL);
        }
    }

    /**
     * Click on add new button by href
     *
     * @param string $href
     */
    protected function clickButtonByHref(string $href): void
    {
        $this->logTestAction("Click button", ['href' => $href]);

        try {
            $xpath = sprintf('//a[@href="%s"]', $href);
            $button = $this->waitForElement($xpath);
            $this->scrollIntoView($button);
            $button->click();
            $this->waitForAjax();
        } catch (Exception $e) {
            $this->handleActionError('click button', $href, $e);
        }
    }

    /**
     * Select tab in tabular menu by anchor
     *
     * @param string $anchor
     */
    protected function changeTabOnCurrentPage(string $anchor): void
    {
        $this->logTestAction("Change tab", ['anchor' => $anchor]);

        try {
            // Scroll to top first
            self::$driver->executeScript(
                "document.getElementById('main').scrollIntoView({block: 'start', inline: 'nearest', behavior: 'instant'})"
            );

            sleep(self::DEFAULT_DELAY);

            $xpath = sprintf(
                '//div[contains(@class, "menu")]//a[contains(@data-tab,"%s")]',
                $anchor
            );

            $tab = $this->waitForElement($xpath);
            $this->scrollIntoView($tab);
            $tab->click();
        } catch (Exception $e) {
            $this->handleActionError('change tab', $anchor, $e);
        }
    }

    /**
     * Open additional settings under accordion element
     */
    protected function openAccordionOnThePage(): void
    {
        $this->logTestAction("Open accordion");

        try {
            $xpath = '//div[contains(@class, "ui") and contains(@class, "accordion")]';
            $accordion = $this->waitForElement($xpath);
            $this->scrollIntoView($accordion);
            $accordion->click();
        } catch (Exception $e) {
            $this->handleActionError('open accordion', '', $e);
        }
    }


    /**
     * Get ID from hidden input at form
     *
     * @return string
     */
    protected function getCurrentRecordID(): string
    {
        try {
            $xpath = '//input[@name="id" and @type="hidden"]';
            $input = $this->waitForElement($xpath);
            return $input->getAttribute('value') ?? 'undefined';
        } catch (Exception $e) {
            $this->handleActionError('get current record ID', '', $e);
            return 'undefined';
        }
    }

    /**
     * Delete all records from table
     *
     * @param string $tableId
     *
     * @return void
     */
    protected function deleteAllRecordsOnTable(string $tableId): void
    {
        $this->logTestAction("Delete all records", ['tableId' => $tableId]);

        try {
            $xpath = sprintf(
                '//table[@id="%s"]//a[contains(@href,"delete") and not(contains(@class,"disabled"))]',
                $tableId
            );

            while ($deleteButton = $this->findElementSafely($xpath)) {
                $this->scrollIntoView($deleteButton);
                $deleteButton->click();
                sleep(self::DEFAULT_DELAY);
                $deleteButton->click();
                $this->waitForAjax();
            }
        } catch (Exception $e) {
            $this->handleActionError('delete all records', $tableId, $e);
        }
    }

    /**
     * Tests element existence on dropdown menu
     *
     * @param string $name element name
     * @param string $value value for search
     *
     * @return bool
     */
    protected function checkIfElementExistOnDropdownMenu(string $name, string $value): bool
    {
        $this->logTestAction("Check dropdown element", ['name' => $name, 'value' => $value]);

        try {
            $dropdown = $this->findAndClickDropdown($name);
            $this->waitForAjax();
            $this->fillDropdownSearch($name, $value);

            $xpath = sprintf(
                '//div[contains(@class, "menu") and contains(@class ,"visible")]/div[contains(text(),"%s")]',
                $value
            );

            return $this->findElementSafely($xpath) !== null;
        } catch (Exception $e) {
            self::annotate("Element check failed: " . $e->getMessage(), 'warning');
            return false;
        }
    }

    /**
     * Fills the DataTable search input field and triggers a 'keyup' event to initiate the search.
     *
     * @param string $name The name of the input field.
     * @param string $value The value to set in the input field.
     *
     * @return void
     */
    protected function fillDataTableSearchInput(string $datatableId, string $name, string $value): void
    {
        $this->logTestAction("Fill datatable search", [
            'datatableId' => $datatableId,
            'name' => $name,
            'value' => $value
        ]);

        try {
            $this->changeInputField($name, $value);

            // Trigger search
            self::$driver->executeScript(
                sprintf(
                    "$('#%s').trigger($.Event('keyup', { keyCode: 13 }));",
                    $name
                )
            );

            $this->waitForAjax();
            usleep(5000000); // Wait for DataTable redraw
        } catch (Exception $e) {
            $this->handleActionError('fill datatable search', $name, $e);
        }
    }

    /**
     * If input filed with $name exists on the page, it value will be changed on $value
     *
     * @param string $name
     * @param string $value
     * @param bool $skipIfNotExist
     */
    protected function changeInputField(string $name, string $value, bool $skipIfNotExist = false): void
    {
        $this->logTestAction("Change input field", ['name' => $name, 'value' => $value]);

        try {
            $types = implode(' or ', array_map(fn($type) => "@type='$type'", self::INPUT_TYPES));
            $xpath = sprintf('//input[@name="%s" and (%s)]', $name, $types);

            $input = $this->findElementSafely($xpath);
            if (!$input && !$skipIfNotExist) {
                throw new RuntimeException("Input field $name not found");
            }

            if ($input) {
                $type = $input->getAttribute('type');
                $id = $input->getAttribute('id');

                if ($type === 'hidden' && $id) {
                    self::$driver->executeScript("document.getElementById('$id').value='$value'");
                } else {
                    $this->scrollIntoView($input);
                    $input->click();
                    $input->clear();
                    $input->sendKeys($value);
                }
            }
        } catch (Exception $e) {
            $this->handleActionError('change input field', $name, $e);
        }
    }

    /**
     * Helper method to check element types
     */
    private function isDropdown(string $name): bool
    {
        return (bool)$this->findElementSafely(
            sprintf('//select[@name="%s"] | //div[@id="%s"][contains(@class,"dropdown")]', $name, $name)
        );
    }

    private function isCheckbox(string $name): bool
    {
        return (bool)$this->findElementSafely(
            sprintf('//input[@name="%s" and @type="checkbox"]', $name)
        );
    }

    private function isTextArea(string $name): bool
    {
        return (bool)$this->findElementSafely(
            sprintf('//textarea[@name="%s"]', $name)
        );
    }
}
