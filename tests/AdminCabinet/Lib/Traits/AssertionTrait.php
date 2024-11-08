<?php

namespace MikoPBX\Tests\AdminCabinet\Lib\Traits;

use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverElement;
use RuntimeException;

/**
 * Trait AssertionTrait
 * Contains all assertion methods for testing UI elements
 */
trait AssertionTrait
{
    /**
     * Assert that input field has specific value
     *
     * @param string $name Field name
     * @param string $expectedValue Expected value
     * @param bool $skipIfNotExist Skip assertion if field not found
     */
    protected function assertInputFieldValueEqual(
        string $name,
        string $expectedValue,
        bool $skipIfNotExist = false
    ): void {
        $xpath = sprintf(
            '//input[@name="%s" and (@type="text" or @type="number" or @type="password" or @type="hidden")]',
            $name
        );
        $inputItems = self::$driver->findElements(WebDriverBy::xpath($xpath));

        if (empty($inputItems) && !$skipIfNotExist) {
            $this->fail("Input field '{$name}' not found");
        }

        foreach ($inputItems as $inputItem) {
            $currentValue = $inputItem->getAttribute('value');
            $this->assertEquals(
                $expectedValue,
                $currentValue,
                "Input field '{$name}' value mismatch. Expected: {$expectedValue}, Got: {$currentValue}"
            );
        }
    }

    /**
     * Assert that textarea has specific value
     *
     * @param string $name Textarea name
     * @param string $expectedValue Expected value
     * @param bool $skipIfNotExist Skip assertion if not found
     */
    protected function assertTextAreaValueIsEqual(
        string $name,
        string $expectedValue,
        bool $skipIfNotExist = false
    ): void {
        $xpath = sprintf('//textarea[@name="%s"]', $name);
        $textArea = $this->findElementSafely($xpath);

        if (!$textArea && !$skipIfNotExist) {
            $this->fail("Textarea '{$name}' not found");
        }

        if ($textArea) {
            $currentValue = $textArea->getAttribute('value');
            $this->assertEquals(
                $expectedValue,
                $currentValue,
                "Textarea '{$name}' value mismatch. Expected: {$expectedValue}, Got: {$currentValue}"
            );
        }
    }

    /**
     * Assert that checkbox has specific state
     *
     * @param string $name Checkbox name
     * @param bool $expectedState Expected state
     * @param bool $skipIfNotExist Skip assertion if not found
     */
    protected function assertCheckBoxStageIsEqual(
        string $name,
        bool $expectedState,
        bool $skipIfNotExist = false
    ): void {
        $xpath = sprintf('//input[@name="%s" and @type="checkbox"]', $name);
        $checkbox = $this->findElementSafely($xpath);

        if (!$checkbox && !$skipIfNotExist) {
            $this->fail("Checkbox '{$name}' not found");
        }

        if ($checkbox) {
            $isChecked = $checkbox->isSelected();
            $stateText = $expectedState ? 'checked' : 'unchecked';
            $this->assertEquals(
                $expectedState,
                $isChecked,
                "Checkbox '{$name}' should be {$stateText}"
            );
        }
    }

    /**
     * Assert that menu item is selected
     *
     * @param string $name Menu name
     * @param string $expectedValue Expected selected value
     * @param bool $skipIfNotExist Skip assertion if not found
     */
    protected function assertMenuItemSelected(
        string $name,
        string $expectedValue,
        bool $skipIfNotExist = false
    ): void {
        $xpath = sprintf('//select[@name="%s"]/option[@selected="selected"]', $name);
        $selected = $this->findElementSafely($xpath);

        if (!$selected && !$skipIfNotExist) {
            $this->fail("Menu item '{$name}' not found");
        }

        if ($selected) {
            $currentValue = $selected->getAttribute('value');
            $this->assertEquals(
                $expectedValue,
                $currentValue,
                "Menu item '{$name}' selection mismatch. Expected: {$expectedValue}, Got: {$currentValue}"
            );
        }
    }

    /**
     * Assert that menu item is not selected
     *
     * @param string $name Menu name
     */
    protected function assertMenuItemNotSelected(string $name): void
    {
        $xpath = sprintf('//select[@name="%s"]/option[@selected="selected"]', $name);
        $this->assertElementNotFound(WebDriverBy::xpath($xpath));
    }

    /**
     * Assert that element exists
     *
     * @param string $xpath Element xpath
     * @param string $message Custom failure message
     */
    protected function assertElementExists(string $xpath, string $message = ''): void
    {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            $this->fail($message ?: "Element not found: {$xpath}");
        }
    }

    /**
     * Assert that element not exists
     *
     * @param WebDriverBy $by Element locator
     * @param string $message Custom failure message
     */
    protected function assertElementNotFound(WebDriverBy $by, string $message = ''): void
    {
        $elements = self::$driver->findElements($by);
        if (!empty($elements)) {
            $this->fail($message ?: "Unexpectedly found element: " . $by->getValue());
        }
        $this->assertTrue(true);
    }

    /**
     * Assert element is visible
     *
     * @param string $xpath Element xpath
     * @param string $message Custom failure message
     */
    protected function assertElementVisible(string $xpath, string $message = ''): void
    {
        try {
            $element = $this->waitForElementState($xpath, self::ELEMENT_STATES['visible']);
            $this->assertTrue($element->isDisplayed(), $message ?: "Element is not visible: {$xpath}");
        } catch (\Exception $e) {
            $this->fail($message ?: "Element visibility check failed: {$xpath}");
        }
    }

    /**
     * Assert element is not visible
     *
     * @param string $xpath Element xpath
     * @param string $message Custom failure message
     */
    protected function assertElementNotVisible(string $xpath, string $message = ''): void
    {
        $element = $this->findElementSafely($xpath);
        if ($element && $element->isDisplayed()) {
            $this->fail($message ?: "Element is unexpectedly visible: {$xpath}");
        }
        $this->assertTrue(true);
    }

    /**
     * Assert element is enabled
     *
     * @param string $xpath Element xpath
     * @param string $message Custom failure message
     */
    protected function assertElementEnabled(string $xpath, string $message = ''): void
    {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            $this->fail("Element not found: {$xpath}");
        }
        $this->assertTrue(
            $element->isEnabled(),
            $message ?: "Element is not enabled: {$xpath}"
        );
    }

    /**
     * Assert element is disabled
     *
     * @param string $xpath Element xpath
     * @param string $message Custom failure message
     */
    protected function assertElementDisabled(string $xpath, string $message = ''): void
    {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            $this->fail("Element not found: {$xpath}");
        }
        $this->assertFalse(
            $element->isEnabled(),
            $message ?: "Element is unexpectedly enabled: {$xpath}"
        );
    }

    /**
     * Assert text present in element
     *
     * @param string $xpath Element xpath
     * @param string $expectedText Expected text
     * @param bool $exact Whether to check for exact match
     * @param string $message Custom failure message
     */
    protected function assertElementText(
        string $xpath,
        string $expectedText,
        bool $exact = false,
        string $message = ''
    ): void {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            $this->fail("Element not found: {$xpath}");
        }

        $actualText = $element->getText();

        if ($exact) {
            $this->assertEquals(
                $expectedText,
                $actualText,
                $message ?: "Element text mismatch"
            );
        } else {
            $this->assertStringContainsString(
                $expectedText,
                $actualText,
                $message ?: "Text not found in element"
            );
        }
    }

    /**
     * Assert element has specific attribute value
     *
     * @param string $xpath Element xpath
     * @param string $attribute Attribute name
     * @param string $expectedValue Expected value
     * @param string $message Custom failure message
     */
    protected function assertElementAttribute(
        string $xpath,
        string $attribute,
        string $expectedValue,
        string $message = ''
    ): void {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            $this->fail("Element not found: {$xpath}");
        }

        $actualValue = $element->getAttribute($attribute);
        $this->assertEquals(
            $expectedValue,
            $actualValue,
            $message ?: "Attribute '{$attribute}' value mismatch"
        );
    }

    /**
     * Assert element has specific CSS class
     *
     * @param string $xpath Element xpath
     * @param string $className Expected class name
     * @param string $message Custom failure message
     */
    protected function assertElementHasClass(
        string $xpath,
        string $className,
        string $message = ''
    ): void {
        $element = $this->findElementSafely($xpath);
        if (!$element) {
            $this->fail("Element not found: {$xpath}");
        }

        $classes = explode(' ', $element->getAttribute('class'));
        $this->assertContains(
            $className,
            $classes,
            $message ?: "Class '{$className}' not found on element"
        );
    }
}