<?php

namespace MikoPBX\Tests\AdminCabinet\Lib\Traits;

use Facebook\WebDriver\Exception\ElementNotInteractableException;
use Facebook\WebDriver\Exception\NoSuchElementException;
use Facebook\WebDriver\Exception\TimeoutException;
use Facebook\WebDriver\Interactions\WebDriverActions;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverElement;
use Facebook\WebDriver\WebDriverExpectedCondition;
use RuntimeException;

/**
 * Trait ElementInteractionTrait
 * Handles all element-related interactions in Selenium tests
 */
trait ElementInteractionTrait
{
    /**
     * Element interaction configuration
     */
    protected const ELEMENT = [
        'timeouts' => [
            'presence' => 10,
            'visibility' => 5,
            'clickable' => 3,
            'retry' => 1
        ],
        'intervals' => [
            'wait' => 500,
            'retry' => 100
        ],
        'retries' => [
            'interaction' => 3,
            'check' => 2
        ]
    ];

    /**
     * Element states for wait conditions
     */
    protected const ELEMENT_STATES = [
        'present' => 'presence',
        'visible' => 'visibility',
        'clickable' => 'clickable',
        'invisible' => 'invisibility',
        'selected' => 'selected',
        'enabled' => 'enabled'
    ];

    /**
     * Interact with element using specified action
     *
     * @param string $xpath Element selector (xpath)
     * @param string $action Action to perform
     * @param array $options Interaction options
     * @throws RuntimeException
     */
    protected function interactWithElement(
        string $xpath,
        string $action,
        array  $options = []
    ): void {
        $defaultOptions = [
            'timeout' => self::ELEMENT['timeouts']['presence'],
            'scroll' => true,
            'waitForElement' => true,
            'waitForAction' => true,
            'retries' => self::ELEMENT['retries']['interaction']
        ];

        $options = array_merge($defaultOptions, $options);

        try {
            $this->executeWithRetry(
                function () use ($xpath, $action, $options) {
                    $element = $options['waitForElement']
                        ? $this->waitForElement($xpath, $options['timeout'])
                        : $this->findElementSafely($xpath);

                    if (!$element) {
                        throw new NoSuchElementException("Element not found: $xpath");
                    }

                    if ($options['scroll']) {
                        $this->scrollIntoView($element);
                    }

                    $this->performElementAction($element, $action);

                    if ($options['waitForAction']) {
                        $this->waitForAjax();
                    }
                },
                $options['retries']
            );
        } catch (\Exception $e) {
            $this->handleActionError("element $action", $xpath, $e);
        }
    }

    /**
     * Wait for element with specified state
     *
     * @param string $selector Element selector
     * @param string $state Required element state
     * @param int $timeout Timeout in seconds
     * @return WebDriverElement|bool
     * @throws TimeoutException
     */
    protected function waitForElementState(
        string $selector,
        string $state = self::ELEMENT_STATES['present'],
        int $timeout = null
    ): WebDriverElement|bool {
        $timeout ??= self::ELEMENT['timeouts']['presence'];

        try {
            return self::$driver->wait($timeout, self::ELEMENT['intervals']['wait'])->until(
                $this->getElementCondition($selector, $state)
            );
        } catch (TimeoutException $e) {
            throw new TimeoutException(
                "Timeout waiting for element state '$state': $selector",
                0,
                $e
            );
        }
    }

    /**
     * Find element safely without throwing exception
     *
     * @param string $xpath Element xpath
     * @return \Facebook\WebDriver\WebDriverElement|null
     */
    protected function findElementSafely(string $xpath): ?\Facebook\WebDriver\WebDriverElement
    {
        try {
            return self::$driver->findElement(WebDriverBy::xpath($xpath));
        } catch (\Facebook\WebDriver\Exception\NoSuchElementException) {
            return null;
        }
    }


    /**
     * Get current record ID from form
     *
     * @return string
     */
    protected function getCurrentRecordID(): string
    {
        try {
            $xpath = '//input[@name="id" and @type="hidden"]';
            $input = $this->waitForElement($xpath);
            return $input->getAttribute('value') ?? 'undefined';
        } catch (\Exception $e) {
            $this->handleActionError('get current record ID', '', $e);
            return 'undefined';
        }
    }

    /**
     * Delete all records from table
     *
     * @param string $tableId Table identifier
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
                sleep(self::ELEMENT['timeouts']['retry']);
                $deleteButton->click(); // Confirm deletion
                $this->waitForAjax();
            }
        } catch (\Exception $e) {
            $this->handleActionError('delete all records', $tableId, $e);
        }
    }

    /**
     * Fill DataTable search input
     *
     * @param string $datatableId DataTable identifier
     * @param string $name Input name
     * @param string $value Search value
     */
    protected function fillDataTableSearchInput(
        string $datatableId,
        string $name,
        string $value
    ): void {
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
            sleep(2);; // Wait for DataTable redraw
        } catch (\Exception $e) {
            $this->handleActionError('fill datatable search', $name, $e);
        }
    }

    /**
     * Private helper methods
     */

    /**
     * Perform specific action on element
     *
     * @param WebDriverElement $element Target element
     * @param string $action Action to perform
     */
    private function performElementAction(WebDriverElement $element, string $action): void
    {
        match($action) {
            'click' => $element->click(),
            'clear' => $element->clear(),
            'submit' => $element->submit(),
            'focus' => self::$driver->executeScript('arguments[0].focus()', [$element]),
            'blur' => self::$driver->executeScript('arguments[0].blur()', [$element]),
            default => throw new RuntimeException("Unknown action: $action")
        };
    }

    /**
     * Get WebDriver condition for element state
     *
     * @param string $selector Element selector
     * @param string $state Required state
     * @return callable
     */
    private function getElementCondition(string $selector, string $state): callable
    {
        $by = WebDriverBy::xpath($selector);

        return match($state) {
            self::ELEMENT_STATES['present'] =>
            WebDriverExpectedCondition::presenceOfElementLocated($by),
            self::ELEMENT_STATES['visible'] =>
            WebDriverExpectedCondition::visibilityOfElementLocated($by),
            self::ELEMENT_STATES['clickable'] =>
            WebDriverExpectedCondition::elementToBeClickable($by),
            self::ELEMENT_STATES['invisible'] =>
            WebDriverExpectedCondition::invisibilityOfElementLocated($by),
            self::ELEMENT_STATES['selected'] =>
            WebDriverExpectedCondition::elementToBeSelected($by),
            self::ELEMENT_STATES['enabled'] =>
            function () use ($by) {
                $element = self::$driver->findElement($by);
                return $element && $element->isEnabled();
            },
            default => throw new RuntimeException("Unknown element state: $state")
        };
    }

    /**
     * Wait for element presence
     *
     * @param string $xpath Element xpath
     * @param int $timeout Timeout in seconds
     * @return WebDriverElement
     * @throws TimeoutException|NoSuchElementException
     */
    protected function waitForElement(
        string $xpath,
        int $timeout = self::ELEMENT['timeouts']['presence']
    ): WebDriverElement {
        return self::$driver->wait($timeout, self::ELEMENT['intervals']['wait'])->until(
            WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::xpath($xpath))
        );
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
        } catch (\Exception $e) {
            $this->fail('Unknown error ' . $e->getMessage() . PHP_EOL);
        }
    }
}