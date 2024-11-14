"use strict";

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

/* global globalRootUrl,globalTranslate, Extensions, Form, SemanticLocalization, SoundFilesSelector */

/**
 * Object for managing Out-of-Work Time settings
 *
 * @module outOfWorkTimeRecord
 */
var outOfWorkTimeRecord = {
  /**
   * jQuery object for the form.
   * @type {jQuery}
   */
  $formObj: $('#save-outoffwork-form'),
  $defaultDropdown: $('#save-outoffwork-form .dropdown-default'),
  $rangeDaysStart: $('#range-days-start'),
  $rangeDaysEnd: $('#range-days-end'),
  $rangeTimeStart: $('#range-time-start'),
  $rangeTimeEnd: $('#range-time-end'),
  $date_from: $('#date_from'),
  $date_to: $('#date_to'),
  $time_to: $('#time_to'),
  $forwardingSelectDropdown: $('#save-outoffwork-form .forwarding-select'),

  /**
   * Additional condition for the time interval
   * @type {array}
   */
  additionalTimeIntervalRules: [{
    type: 'regExp',
    value: /^(2[0-3]|1?[0-9]):([0-5]?[0-9])$/,
    prompt: globalTranslate.tf_ValidateCheckTimeInterval
  }],

  /**
   * Validation rules for the form fields before submission.
   *
   * @type {object}
   */
  validateRules: {
    audio_message_id: {
      identifier: 'audio_message_id',
      rules: [{
        type: 'customNotEmptyIfActionRule[playmessage]',
        prompt: globalTranslate.tf_ValidateAudioMessageEmpty
      }]
    },
    calUrl: {
      identifier: 'calUrl',
      rules: [{
        type: 'customNotEmptyIfCalType',
        prompt: globalTranslate.tf_ValidateCalUri
      }]
    },
    extension: {
      identifier: 'extension',
      rules: [{
        type: 'customNotEmptyIfActionRule[extension]',
        prompt: globalTranslate.tf_ValidateExtensionEmpty
      }]
    },
    timefrom: {
      optional: true,
      identifier: 'time_from',
      rules: [{
        type: 'regExp',
        value: /^(2[0-3]|1?[0-9]):([0-5]?[0-9])$/,
        prompt: globalTranslate.tf_ValidateCheckTimeInterval
      }]
    },
    timeto: {
      identifier: 'time_to',
      optional: true,
      rules: [{
        type: 'regExp',
        value: /^(2[0-3]|1?[0-9]):([0-5]?[0-9])$/,
        prompt: globalTranslate.tf_ValidateCheckTimeInterval
      }]
    }
  },

  /**
   * Initializes the out of work time record form.
   */
  initialize: function initialize() {
    // Initialize tab behavior for the out-time-modify-menu
    $('#out-time-modify-menu .item').tab(); // Initialize the default dropdown

    outOfWorkTimeRecord.$defaultDropdown.dropdown(); // Initialize the calendar for range days start

    outOfWorkTimeRecord.$rangeDaysStart.calendar({
      // Calendar configuration options
      firstDayOfWeek: SemanticLocalization.calendarFirstDayOfWeek,
      text: SemanticLocalization.calendarText,
      endCalendar: outOfWorkTimeRecord.$rangeDaysEnd,
      type: 'date',
      inline: false,
      monthFirst: false,
      regExp: SemanticLocalization.regExp
    }); // Initialize the calendar for range days end

    outOfWorkTimeRecord.$rangeDaysEnd.calendar({
      // Calendar configuration options
      firstDayOfWeek: SemanticLocalization.calendarFirstDayOfWeek,
      text: SemanticLocalization.calendarText,
      startCalendar: outOfWorkTimeRecord.$rangeDaysStart,
      type: 'date',
      inline: false,
      monthFirst: false,
      regExp: SemanticLocalization.regExp,
      onChange: function onChange(newDateTo) {
        // Handle the change event for range time end
        var oldDateTo = outOfWorkTimeRecord.$date_to.attr('value');

        if (newDateTo !== null && oldDateTo !== '') {
          oldDateTo = new Date(oldDateTo * 1000);

          if (newDateTo - oldDateTo !== 0) {
            outOfWorkTimeRecord.$date_from.trigger('change');
            Form.dataChanged();
          }
        }
      }
    }); // Initialize the calendar for range time start

    outOfWorkTimeRecord.$rangeTimeStart.calendar({
      // Calendar configuration options
      firstDayOfWeek: SemanticLocalization.calendarFirstDayOfWeek,
      text: SemanticLocalization.calendarText,
      endCalendar: outOfWorkTimeRecord.$rangeTimeEnd,
      type: 'time',
      inline: false,
      disableMinute: true,
      ampm: false
    }); // Initialize the calendar for range time end

    outOfWorkTimeRecord.$rangeTimeEnd.calendar({
      // Calendar configuration options
      firstDayOfWeek: SemanticLocalization.calendarFirstDayOfWeek,
      text: SemanticLocalization.calendarText,
      type: 'time',
      inline: false,
      disableMinute: true,
      ampm: false,
      onChange: function onChange(newTimeTo) {
        // Handle the change event for range time end
        var oldTimeTo = outOfWorkTimeRecord.$time_to.attr('value');

        if (newTimeTo !== null && oldTimeTo !== '') {
          oldTimeTo = new Date(oldTimeTo * 1000);

          if (newTimeTo - oldTimeTo !== 0) {
            outOfWorkTimeRecord.$time_to.trigger('change');
            Form.dataChanged();
          }
        }
      }
    }); // Initialize the action dropdown

    $('#action').dropdown({
      onChange: function onChange() {
        // Handle the change event for the action dropdown
        outOfWorkTimeRecord.toggleDisabledFieldClass();
      }
    }); // Initialize the calType dropdown

    $('#calType').dropdown({
      onChange: function onChange() {
        // Handle the change event for the action dropdown
        outOfWorkTimeRecord.toggleDisabledFieldClass();
      }
    }); // Initialize the weekday_from dropdown

    $('#weekday_from').dropdown({
      onChange: function onChange() {
        // Handle the change event for the weekday_from dropdown
        var from = outOfWorkTimeRecord.$formObj.form('get value', 'weekday_from');
        var to = outOfWorkTimeRecord.$formObj.form('get value', 'weekday_to');

        if (from < to || to === -1 || from === -1) {
          outOfWorkTimeRecord.$formObj.form('set value', 'weekday_to', from);
        }
      }
    }); // Initialize the weekday_to dropdown

    $('#weekday_to').dropdown({
      onChange: function onChange() {
        // Handle the change event for the weekday_to dropdown
        var from = outOfWorkTimeRecord.$formObj.form('get value', 'weekday_from');
        var to = outOfWorkTimeRecord.$formObj.form('get value', 'weekday_to');

        if (to < from || from === -1) {
          outOfWorkTimeRecord.$formObj.form('set value', 'weekday_from', to);
        }
      }
    }); // Bind click event to erase-dates button

    $('#erase-dates').on('click', function (e) {
      // Handle the click event for erase-dates button
      outOfWorkTimeRecord.$rangeDaysStart.calendar('clear');
      outOfWorkTimeRecord.$rangeDaysEnd.calendar('clear');
      outOfWorkTimeRecord.$formObj.form('set values', {
        date_from: '',
        date_to: ''
      });
      e.preventDefault();
    }); // Bind click event to erase-weekdays button

    $('#erase-weekdays').on('click', function (e) {
      // Handle the click event for erase-weekdays button
      outOfWorkTimeRecord.$formObj.form('set values', {
        weekday_from: -1,
        weekday_to: -1
      });
      outOfWorkTimeRecord.$rangeDaysStart.trigger('change');
      e.preventDefault();
    }); // Bind click event to erase-timeperiod button

    $('#erase-timeperiod').on('click', function (e) {
      // Handle the click event for erase-timeperiod button
      outOfWorkTimeRecord.$rangeTimeStart.calendar('clear');
      outOfWorkTimeRecord.$rangeTimeEnd.calendar('clear');
      outOfWorkTimeRecord.$time_to.trigger('change');
      e.preventDefault();
    }); // Initialize audio-message-select dropdown

    $('#save-outoffwork-form .audio-message-select').dropdown(SoundFilesSelector.getDropdownSettingsWithEmpty()); // Change the date format from linuxtime to local representation

    outOfWorkTimeRecord.changeDateFormat(); // Initialize the form

    outOfWorkTimeRecord.initializeForm(); // Initialize the forwardingSelectDropdown

    outOfWorkTimeRecord.$forwardingSelectDropdown.dropdown(Extensions.getDropdownSettingsWithoutEmpty()); // Toggle disabled field class based on action value

    outOfWorkTimeRecord.toggleDisabledFieldClass(); // Bind checkbox change event for inbound rules table

    $('#inbound-rules-table .ui.checkbox').checkbox({
      onChange: function onChange() {
        var newState = 'unchecked'; // Handle the change event for inbound rules table checkbox

        if ($(this).parent().checkbox('is checked')) {
          newState = 'checked';
        }

        var did = $(this).parent().attr('data-did');
        var filter = '#inbound-rules-table .ui.checkbox[data-context-id=' + $(this).parent().attr('data-context-id') + ']';

        if (did !== '' && newState === 'checked') {
          filter = filter + '.ui.checkbox[data-did=' + did + ']';
        } else if (did !== '' && newState === 'unchecked') {
          $(filter + '.ui.checkbox[data-did="' + did + '"]').checkbox('set ' + newState);
          filter = filter + '.ui.checkbox[data-did=""]';
        } else if (did === '' && newState === 'unchecked') {
          filter = filter + '.ui.checkbox[data-did=""]';
        }

        $(filter).checkbox('set ' + newState);
      }
    }); // Bind checkbox change event for allowRestriction checkbox

    $('#allowRestriction').parent().checkbox({
      onChange: outOfWorkTimeRecord.changeRestriction
    }); // Call changeRestriction method

    outOfWorkTimeRecord.changeRestriction();
  },

  /**
   * Changes the visibility of the 'rules' tab based on the checked status of the 'allowRestriction' checkbox.
   */
  changeRestriction: function changeRestriction() {
    if ($('#allowRestriction').parent().checkbox('is checked')) {
      $("a[data-tab='rules']").show();
    } else {
      $("a[data-tab='rules']").hide();
    }
  },

  /**
   * Converts the date format from linuxtime to the local representation.
   */
  changeDateFormat: function changeDateFormat() {
    var dateFrom = outOfWorkTimeRecord.$date_from.attr('value');
    var dateTo = outOfWorkTimeRecord.$date_to.attr('value');
    var currentOffset = new Date().getTimezoneOffset();
    var serverOffset = parseInt(outOfWorkTimeRecord.$formObj.form('get value', 'serverOffset'));
    var offsetDiff = serverOffset + currentOffset;

    if (dateFrom !== undefined && dateFrom.length > 0) {
      var dateFromInBrowserTZ = dateFrom * 1000 + offsetDiff * 60 * 1000;
      outOfWorkTimeRecord.$rangeDaysStart.calendar('set date', new Date(dateFromInBrowserTZ));
    }

    if (dateTo !== undefined && dateTo.length > 0) {
      var dateToInBrowserTZ = dateTo * 1000 + offsetDiff * 60 * 1000;
      outOfWorkTimeRecord.$rangeDaysEnd.calendar('set date', new Date(dateToInBrowserTZ));
    }
  },

  /**
   * Toggles the visibility of certain field groups based on the selected action value.
   */
  toggleDisabledFieldClass: function toggleDisabledFieldClass() {
    if (outOfWorkTimeRecord.$formObj.form('get value', 'action') === 'extension') {
      $('#extension-group').show();
      $('#audio-file-group').hide();
      $('#audio_message_id').dropdown('clear');
    } else {
      $('#extension-group').hide();
      $('#audio-file-group').show();
      outOfWorkTimeRecord.$formObj.form('set value', 'extension', -1);
    }

    if (outOfWorkTimeRecord.$formObj.form('get value', 'calType') === 'none') {
      $('#call-type-main-tab').show();
      $('#call-type-calendar-tab').hide();
    } else {
      $('#call-type-main-tab').hide();
      $('#call-type-calendar-tab').show();
    }
  },

  /**
   * Custom form validation for validating specific fields in a form.
   *
   * @param {Object} result - The result object containing form data.
   * @returns {boolean|Object} Returns false if validation fails, or the result object if validation passes.
   */
  customValidateForm: function customValidateForm(result) {
    // Check date fields
    if (result.data.date_from !== '' && result.data.date_to === '' || result.data.date_to !== '' && result.data.date_from === '') {
      $('.form .error.message').html(globalTranslate.tf_ValidateCheckDateInterval).show();
      Form.$submitButton.transition('shake').removeClass('loading disabled');
      return false;
    } // Check weekday fields


    if (result.data.weekday_from > 0 && result.data.weekday_to === '-1' || result.data.weekday_to > 0 && result.data.weekday_from === '-1') {
      $('.form .error.message').html(globalTranslate.tf_ValidateCheckWeekDayInterval).show();
      Form.$submitButton.transition('shake').removeClass('loading disabled');
      return false;
    } // Check time fields


    if (result.data.time_from.length > 0 && result.data.time_to.length === 0 || result.data.time_to.length > 0 && result.data.time_from.length === 0) {
      $('.form .error.message').html(globalTranslate.tf_ValidateCheckTimeInterval).show();
      Form.$submitButton.transition('shake').removeClass('loading disabled');
      return false;
    } // Check time field format


    if (result.data.time_from.length > 0 && result.data.time_to.length === 0 || result.data.time_to.length > 0 && result.data.time_from.length === 0) {
      $('.form .error.message').html(globalTranslate.tf_ValidateCheckTimeInterval).show();
      Form.$submitButton.transition('shake').removeClass('loading disabled');
      return false;
    } // Check all fields


    if ($('#calType').parent().dropdown('get value') === 'none' && result.data.time_from === '' && result.data.time_to === '' && result.data.weekday_from === '-1' && result.data.weekday_to === '-1' && result.data.date_from === '' && result.data.date_to === '') {
      $('.form .error.message').html(globalTranslate.tf_ValidateNoRulesSelected).show();
      Form.$submitButton.transition('shake').removeClass('loading disabled');
      return false;
    }

    return result;
  },

  /**
   * Callback function to be called before the form is sent
   * @param {Object} settings - The current settings of the form
   * @returns {Object} - The updated settings of the form
   */
  cbBeforeSendForm: function cbBeforeSendForm(settings) {
    var result = settings;
    $('.form .error.message').html('').hide();
    result.data = outOfWorkTimeRecord.$formObj.form('get values');
    var dateFrom = outOfWorkTimeRecord.$rangeDaysStart.calendar('get date');
    var dateTo = outOfWorkTimeRecord.$rangeDaysEnd.calendar('get date');
    var currentOffset = new Date().getTimezoneOffset();
    var serverOffset = parseInt(outOfWorkTimeRecord.$formObj.form('get value', 'serverOffset'));
    var offsetDiff = serverOffset + currentOffset;

    if ($('#calType').parent().dropdown('get value') === 'none') {
      Form.validateRules.timefrom.rules = outOfWorkTimeRecord.additionalTimeIntervalRules;
      Form.validateRules.timeto.rules = outOfWorkTimeRecord.additionalTimeIntervalRules;
    } else {
      Form.validateRules.timefrom.rules = [];
      Form.validateRules.timeto.rules = [];
    }

    if (dateFrom) {
      dateFrom.setHours(0, 0, 0, 0);
      result.data.date_from = Math.floor(dateFrom.getTime() / 1000) - offsetDiff * 60;
    }

    if (dateTo) {
      dateTo.setHours(23, 59, 59, 0);
      result.data.date_to = Math.floor(dateTo.getTime() / 1000) - offsetDiff * 60;
    }

    return outOfWorkTimeRecord.customValidateForm(result);
  },

  /**
   * Callback function to be called after the form has been sent.
   * @param {Object} response - The response from the server after the form is sent
   */
  cbAfterSendForm: function cbAfterSendForm(response) {},

  /**
   * Initialize the form with custom settings
   */
  initializeForm: function initializeForm() {
    Form.$formObj = outOfWorkTimeRecord.$formObj;
    Form.url = "".concat(globalRootUrl, "out-off-work-time/save"); // Form submission URL

    Form.validateRules = outOfWorkTimeRecord.validateRules; // Form validation rules

    Form.cbBeforeSendForm = outOfWorkTimeRecord.cbBeforeSendForm; // Callback before form is sent

    Form.cbAfterSendForm = outOfWorkTimeRecord.cbAfterSendForm; // Callback after form is sent

    Form.initialize();
  }
};
/**
 * Custom form validation rule that checks if a value is not empty based on a specific action.
 *
 * @param {string} value - The value to be validated.
 * @param {string} action - The action to compare against.
 * @returns {boolean} Returns true if the value is not empty or the action does not match, false otherwise.
 */

$.fn.form.settings.rules.customNotEmptyIfActionRule = function (value, action) {
  if (value.length === 0 && $('#action').val() === action) {
    return false;
  }

  return true;
};
/**
 * Custom form validation rule that checks if a value is not empty based on a specific action.
 *
 * @param {string} value - The value to be validated.
 * @returns {boolean} Returns true if the value is not empty or the action does not match, false otherwise.
 */


$.fn.form.settings.rules.customNotEmptyIfCalType = function (value) {
  if ($('#calType').val() === 'none') {
    return true;
  }

  try {
    var url = new URL(value);
  } catch (_) {
    return false;
  }

  return true;
};
/**
 *  Initialize out of work form on document ready
 */


$(document).ready(function () {
  outOfWorkTimeRecord.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9PdXRPZmZXb3JrVGltZS9vdXQtb2Ytd29yay10aW1lLW1vZGlmeS5qcyJdLCJuYW1lcyI6WyJvdXRPZldvcmtUaW1lUmVjb3JkIiwiJGZvcm1PYmoiLCIkIiwiJGRlZmF1bHREcm9wZG93biIsIiRyYW5nZURheXNTdGFydCIsIiRyYW5nZURheXNFbmQiLCIkcmFuZ2VUaW1lU3RhcnQiLCIkcmFuZ2VUaW1lRW5kIiwiJGRhdGVfZnJvbSIsIiRkYXRlX3RvIiwiJHRpbWVfdG8iLCIkZm9yd2FyZGluZ1NlbGVjdERyb3Bkb3duIiwiYWRkaXRpb25hbFRpbWVJbnRlcnZhbFJ1bGVzIiwidHlwZSIsInZhbHVlIiwicHJvbXB0IiwiZ2xvYmFsVHJhbnNsYXRlIiwidGZfVmFsaWRhdGVDaGVja1RpbWVJbnRlcnZhbCIsInZhbGlkYXRlUnVsZXMiLCJhdWRpb19tZXNzYWdlX2lkIiwiaWRlbnRpZmllciIsInJ1bGVzIiwidGZfVmFsaWRhdGVBdWRpb01lc3NhZ2VFbXB0eSIsImNhbFVybCIsInRmX1ZhbGlkYXRlQ2FsVXJpIiwiZXh0ZW5zaW9uIiwidGZfVmFsaWRhdGVFeHRlbnNpb25FbXB0eSIsInRpbWVmcm9tIiwib3B0aW9uYWwiLCJ0aW1ldG8iLCJpbml0aWFsaXplIiwidGFiIiwiZHJvcGRvd24iLCJjYWxlbmRhciIsImZpcnN0RGF5T2ZXZWVrIiwiU2VtYW50aWNMb2NhbGl6YXRpb24iLCJjYWxlbmRhckZpcnN0RGF5T2ZXZWVrIiwidGV4dCIsImNhbGVuZGFyVGV4dCIsImVuZENhbGVuZGFyIiwiaW5saW5lIiwibW9udGhGaXJzdCIsInJlZ0V4cCIsInN0YXJ0Q2FsZW5kYXIiLCJvbkNoYW5nZSIsIm5ld0RhdGVUbyIsIm9sZERhdGVUbyIsImF0dHIiLCJEYXRlIiwidHJpZ2dlciIsIkZvcm0iLCJkYXRhQ2hhbmdlZCIsImRpc2FibGVNaW51dGUiLCJhbXBtIiwibmV3VGltZVRvIiwib2xkVGltZVRvIiwidG9nZ2xlRGlzYWJsZWRGaWVsZENsYXNzIiwiZnJvbSIsImZvcm0iLCJ0byIsIm9uIiwiZSIsImRhdGVfZnJvbSIsImRhdGVfdG8iLCJwcmV2ZW50RGVmYXVsdCIsIndlZWtkYXlfZnJvbSIsIndlZWtkYXlfdG8iLCJTb3VuZEZpbGVzU2VsZWN0b3IiLCJnZXREcm9wZG93blNldHRpbmdzV2l0aEVtcHR5IiwiY2hhbmdlRGF0ZUZvcm1hdCIsImluaXRpYWxpemVGb3JtIiwiRXh0ZW5zaW9ucyIsImdldERyb3Bkb3duU2V0dGluZ3NXaXRob3V0RW1wdHkiLCJjaGVja2JveCIsIm5ld1N0YXRlIiwicGFyZW50IiwiZGlkIiwiZmlsdGVyIiwiY2hhbmdlUmVzdHJpY3Rpb24iLCJzaG93IiwiaGlkZSIsImRhdGVGcm9tIiwiZGF0ZVRvIiwiY3VycmVudE9mZnNldCIsImdldFRpbWV6b25lT2Zmc2V0Iiwic2VydmVyT2Zmc2V0IiwicGFyc2VJbnQiLCJvZmZzZXREaWZmIiwidW5kZWZpbmVkIiwibGVuZ3RoIiwiZGF0ZUZyb21JbkJyb3dzZXJUWiIsImRhdGVUb0luQnJvd3NlclRaIiwiY3VzdG9tVmFsaWRhdGVGb3JtIiwicmVzdWx0IiwiZGF0YSIsImh0bWwiLCJ0Zl9WYWxpZGF0ZUNoZWNrRGF0ZUludGVydmFsIiwiJHN1Ym1pdEJ1dHRvbiIsInRyYW5zaXRpb24iLCJyZW1vdmVDbGFzcyIsInRmX1ZhbGlkYXRlQ2hlY2tXZWVrRGF5SW50ZXJ2YWwiLCJ0aW1lX2Zyb20iLCJ0aW1lX3RvIiwidGZfVmFsaWRhdGVOb1J1bGVzU2VsZWN0ZWQiLCJjYkJlZm9yZVNlbmRGb3JtIiwic2V0dGluZ3MiLCJzZXRIb3VycyIsIk1hdGgiLCJmbG9vciIsImdldFRpbWUiLCJjYkFmdGVyU2VuZEZvcm0iLCJyZXNwb25zZSIsInVybCIsImdsb2JhbFJvb3RVcmwiLCJmbiIsImN1c3RvbU5vdEVtcHR5SWZBY3Rpb25SdWxlIiwiYWN0aW9uIiwidmFsIiwiY3VzdG9tTm90RW1wdHlJZkNhbFR5cGUiLCJVUkwiLCJfIiwiZG9jdW1lbnQiLCJyZWFkeSJd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LEVBQVc7QUFDMUQsTUFBSVosQ0FBQyxDQUFDLFVBQUQsQ0FBRCxDQUFjbUgsR0FBZCxPQUF3QixNQUE1QixFQUFvQztBQUNoQyxXQUFPLElBQVA7QUFDSDs7QUFDRCxNQUFJO0FBQ0EsUUFBSUwsR0FBRyxHQUFHLElBQUlPLEdBQUosQ0FBUXpHLEtBQVIsQ0FBVjtBQUNILEdBRkQsQ0FFRSxPQUFPMEcsQ0FBUCxFQUFVO0FBQ1IsV0FBTyxLQUFQO0FBQ0g7O0FBQ0QsU0FBTyxJQUFQO0FBQ0gsQ0FWRDtBQWFBO0FBQ0E7QUFDQTs7O0FBQ0F0SCxDQUFDLENBQUN1SCxRQUFELENBQUQsQ0FBWUMsS0FBWixDQUFrQixZQUFNO0FBQ3BCMUgsRUFBQUEsbUJBQW1CLENBQUM4QixVQUFwQjtBQUNILENBRkQiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogTWlrb1BCWCAtIGZyZWUgcGhvbmUgc3lzdGVtIGZvciBzbWFsbCBidXNpbmVzc1xuICogQ29weXJpZ2h0IMKpIDIwMTctMjAyMyBBbGV4ZXkgUG9ydG5vdiBhbmQgTmlrb2xheSBCZWtldG92XG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcbiAqIGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG4gKiB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uOyBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuICogKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG4gKiBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHBzOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiAqL1xuXG4vKiBnbG9iYWwgZ2xvYmFsUm9vdFVybCxnbG9iYWxUcmFuc2xhdGUsIEV4dGVuc2lvbnMsIEZvcm0sIFNlbWFudGljTG9jYWxpemF0aW9uLCBTb3VuZEZpbGVzU2VsZWN0b3IgKi9cblxuXG4vKipcbiAqIE9iamVjdCBmb3IgbWFuYWdpbmcgT3V0LW9mLVdvcmsgVGltZSBzZXR0aW5nc1xuICpcbiAqIEBtb2R1bGUgb3V0T2ZXb3JrVGltZVJlY29yZFxuICovXG5jb25zdCBvdXRPZldvcmtUaW1lUmVjb3JkID0ge1xuICAgIC8qKlxuICAgICAqIGpRdWVyeSBvYmplY3QgZm9yIHRoZSBmb3JtLlxuICAgICAqIEB0eXBlIHtqUXVlcnl9XG4gICAgICovXG4gICAgJGZvcm1PYmo6ICQoJyNzYXZlLW91dG9mZndvcmstZm9ybScpLFxuXG4gICAgJGRlZmF1bHREcm9wZG93bjogJCgnI3NhdmUtb3V0b2Zmd29yay1mb3JtIC5kcm9wZG93bi1kZWZhdWx0JyksXG4gICAgJHJhbmdlRGF5c1N0YXJ0OiAkKCcjcmFuZ2UtZGF5cy1zdGFydCcpLFxuICAgICRyYW5nZURheXNFbmQ6ICQoJyNyYW5nZS1kYXlzLWVuZCcpLFxuICAgICRyYW5nZVRpbWVTdGFydDogJCgnI3JhbmdlLXRpbWUtc3RhcnQnKSxcbiAgICAkcmFuZ2VUaW1lRW5kOiAkKCcjcmFuZ2UtdGltZS1lbmQnKSxcbiAgICAkZGF0ZV9mcm9tOiAkKCcjZGF0ZV9mcm9tJyksXG4gICAgJGRhdGVfdG86ICQoJyNkYXRlX3RvJyksXG4gICAgJHRpbWVfdG86ICQoJyN0aW1lX3RvJyksXG4gICAgJGZvcndhcmRpbmdTZWxlY3REcm9wZG93bjogJCgnI3NhdmUtb3V0b2Zmd29yay1mb3JtIC5mb3J3YXJkaW5nLXNlbGVjdCcpLFxuXG5cbiAgICAvKipcbiAgICAgKiBBZGRpdGlvbmFsIGNvbmRpdGlvbiBmb3IgdGhlIHRpbWUgaW50ZXJ2YWxcbiAgICAgKiBAdHlwZSB7YXJyYXl9XG4gICAgICovXG4gICAgYWRkaXRpb25hbFRpbWVJbnRlcnZhbFJ1bGVzOiBbe1xuICAgICAgICB0eXBlOiAncmVnRXhwJyxcbiAgICAgICAgdmFsdWU6IC9eKDJbMC0zXXwxP1swLTldKTooWzAtNV0/WzAtOV0pJC8sXG4gICAgICAgIHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLnRmX1ZhbGlkYXRlQ2hlY2tUaW1lSW50ZXJ2YWwsXG4gICAgfV0sXG5cbiAgICAvKipcbiAgICAgKiBWYWxpZGF0aW9uIHJ1bGVzIGZvciB0aGUgZm9ybSBmaWVsZHMgYmVmb3JlIHN1Ym1pc3Npb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqL1xuICAgIHZhbGlkYXRlUnVsZXM6IHtcbiAgICAgICAgYXVkaW9fbWVzc2FnZV9pZDoge1xuICAgICAgICAgICAgaWRlbnRpZmllcjogJ2F1ZGlvX21lc3NhZ2VfaWQnLFxuICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjdXN0b21Ob3RFbXB0eUlmQWN0aW9uUnVsZVtwbGF5bWVzc2FnZV0nLFxuICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IGdsb2JhbFRyYW5zbGF0ZS50Zl9WYWxpZGF0ZUF1ZGlvTWVzc2FnZUVtcHR5LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBjYWxVcmw6IHtcbiAgICAgICAgICAgIGlkZW50aWZpZXI6ICdjYWxVcmwnLFxuICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgICA6ICdjdXN0b21Ob3RFbXB0eUlmQ2FsVHlwZScsXG4gICAgICAgICAgICAgICAgICAgIHByb21wdCA6IGdsb2JhbFRyYW5zbGF0ZS50Zl9WYWxpZGF0ZUNhbFVyaVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcbiAgICAgICAgZXh0ZW5zaW9uOiB7XG4gICAgICAgICAgICBpZGVudGlmaWVyOiAnZXh0ZW5zaW9uJyxcbiAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY3VzdG9tTm90RW1wdHlJZkFjdGlvblJ1bGVbZXh0ZW5zaW9uXScsXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLnRmX1ZhbGlkYXRlRXh0ZW5zaW9uRW1wdHksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVmcm9tOiB7XG4gICAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgICAgIGlkZW50aWZpZXI6ICd0aW1lX2Zyb20nLFxuICAgICAgICAgICAgcnVsZXM6IFt7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3JlZ0V4cCcsXG4gICAgICAgICAgICAgICAgdmFsdWU6IC9eKDJbMC0zXXwxP1swLTldKTooWzAtNV0/WzAtOV0pJC8sXG4gICAgICAgICAgICAgICAgcHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUudGZfVmFsaWRhdGVDaGVja1RpbWVJbnRlcnZhbCxcbiAgICAgICAgICAgIH1dLFxuICAgICAgICB9LFxuICAgICAgICB0aW1ldG86IHtcbiAgICAgICAgICAgIGlkZW50aWZpZXI6ICd0aW1lX3RvJyxcbiAgICAgICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgICAgICAgcnVsZXM6IFt7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3JlZ0V4cCcsXG4gICAgICAgICAgICAgICAgdmFsdWU6IC9eKDJbMC0zXXwxP1swLTldKTooWzAtNV0/WzAtOV0pJC8sXG4gICAgICAgICAgICAgICAgcHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUudGZfVmFsaWRhdGVDaGVja1RpbWVJbnRlcnZhbCxcbiAgICAgICAgICAgIH1dLFxuICAgICAgICB9LFxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgb3V0IG9mIHdvcmsgdGltZSByZWNvcmQgZm9ybS5cbiAgICAgKi9cbiAgICBpbml0aWFsaXplKCkge1xuICAgICAgICAvLyBJbml0aWFsaXplIHRhYiBiZWhhdmlvciBmb3IgdGhlIG91dC10aW1lLW1vZGlmeS1tZW51XG4gICAgICAgICQoJyNvdXQtdGltZS1tb2RpZnktbWVudSAuaXRlbScpLnRhYigpO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIGRlZmF1bHQgZHJvcGRvd25cbiAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kZGVmYXVsdERyb3Bkb3duLmRyb3Bkb3duKCk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgY2FsZW5kYXIgZm9yIHJhbmdlIGRheXMgc3RhcnRcbiAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VEYXlzU3RhcnQuY2FsZW5kYXIoe1xuICAgICAgICAgICAgLy8gQ2FsZW5kYXIgY29uZmlndXJhdGlvbiBvcHRpb25zXG4gICAgICAgICAgICBmaXJzdERheU9mV2VlazogU2VtYW50aWNMb2NhbGl6YXRpb24uY2FsZW5kYXJGaXJzdERheU9mV2VlayxcbiAgICAgICAgICAgIHRleHQ6IFNlbWFudGljTG9jYWxpemF0aW9uLmNhbGVuZGFyVGV4dCxcbiAgICAgICAgICAgIGVuZENhbGVuZGFyOiBvdXRPZldvcmtUaW1lUmVjb3JkLiRyYW5nZURheXNFbmQsXG4gICAgICAgICAgICB0eXBlOiAnZGF0ZScsXG4gICAgICAgICAgICBpbmxpbmU6IGZhbHNlLFxuICAgICAgICAgICAgbW9udGhGaXJzdDogZmFsc2UsXG4gICAgICAgICAgICByZWdFeHA6IFNlbWFudGljTG9jYWxpemF0aW9uLnJlZ0V4cCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgY2FsZW5kYXIgZm9yIHJhbmdlIGRheXMgZW5kXG4gICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQuJHJhbmdlRGF5c0VuZC5jYWxlbmRhcih7XG4gICAgICAgICAgICAvLyBDYWxlbmRhciBjb25maWd1cmF0aW9uIG9wdGlvbnNcbiAgICAgICAgICAgIGZpcnN0RGF5T2ZXZWVrOiBTZW1hbnRpY0xvY2FsaXphdGlvbi5jYWxlbmRhckZpcnN0RGF5T2ZXZWVrLFxuICAgICAgICAgICAgdGV4dDogU2VtYW50aWNMb2NhbGl6YXRpb24uY2FsZW5kYXJUZXh0LFxuICAgICAgICAgICAgc3RhcnRDYWxlbmRhcjogb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VEYXlzU3RhcnQsXG4gICAgICAgICAgICB0eXBlOiAnZGF0ZScsXG4gICAgICAgICAgICBpbmxpbmU6IGZhbHNlLFxuICAgICAgICAgICAgbW9udGhGaXJzdDogZmFsc2UsXG4gICAgICAgICAgICByZWdFeHA6IFNlbWFudGljTG9jYWxpemF0aW9uLnJlZ0V4cCxcbiAgICAgICAgICAgIG9uQ2hhbmdlOiAobmV3RGF0ZVRvKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBjaGFuZ2UgZXZlbnQgZm9yIHJhbmdlIHRpbWUgZW5kXG4gICAgICAgICAgICAgICAgbGV0IG9sZERhdGVUbyA9IG91dE9mV29ya1RpbWVSZWNvcmQuJGRhdGVfdG8uYXR0cigndmFsdWUnKTtcbiAgICAgICAgICAgICAgICBpZiAobmV3RGF0ZVRvICE9PSBudWxsICYmIG9sZERhdGVUbyAhPT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgb2xkRGF0ZVRvID0gbmV3IERhdGUob2xkRGF0ZVRvICogMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICgobmV3RGF0ZVRvIC0gb2xkRGF0ZVRvKSAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kZGF0ZV9mcm9tLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgRm9ybS5kYXRhQ2hhbmdlZCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgY2FsZW5kYXIgZm9yIHJhbmdlIHRpbWUgc3RhcnRcbiAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VUaW1lU3RhcnQuY2FsZW5kYXIoe1xuICAgICAgICAgICAgLy8gQ2FsZW5kYXIgY29uZmlndXJhdGlvbiBvcHRpb25zXG4gICAgICAgICAgICBmaXJzdERheU9mV2VlazogU2VtYW50aWNMb2NhbGl6YXRpb24uY2FsZW5kYXJGaXJzdERheU9mV2VlayxcbiAgICAgICAgICAgIHRleHQ6IFNlbWFudGljTG9jYWxpemF0aW9uLmNhbGVuZGFyVGV4dCxcbiAgICAgICAgICAgIGVuZENhbGVuZGFyOiBvdXRPZldvcmtUaW1lUmVjb3JkLiRyYW5nZVRpbWVFbmQsXG4gICAgICAgICAgICB0eXBlOiAndGltZScsXG4gICAgICAgICAgICBpbmxpbmU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzYWJsZU1pbnV0ZTogdHJ1ZSxcbiAgICAgICAgICAgIGFtcG06IGZhbHNlLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBjYWxlbmRhciBmb3IgcmFuZ2UgdGltZSBlbmRcbiAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VUaW1lRW5kLmNhbGVuZGFyKHtcbiAgICAgICAgICAgIC8vIENhbGVuZGFyIGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuICAgICAgICAgICAgZmlyc3REYXlPZldlZWs6IFNlbWFudGljTG9jYWxpemF0aW9uLmNhbGVuZGFyRmlyc3REYXlPZldlZWssXG4gICAgICAgICAgICB0ZXh0OiBTZW1hbnRpY0xvY2FsaXphdGlvbi5jYWxlbmRhclRleHQsXG4gICAgICAgICAgICB0eXBlOiAndGltZScsXG4gICAgICAgICAgICBpbmxpbmU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzYWJsZU1pbnV0ZTogdHJ1ZSxcbiAgICAgICAgICAgIGFtcG06IGZhbHNlLFxuICAgICAgICAgICAgb25DaGFuZ2U6IChuZXdUaW1lVG8pID0+IHtcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgdGhlIGNoYW5nZSBldmVudCBmb3IgcmFuZ2UgdGltZSBlbmRcbiAgICAgICAgICAgICAgICBsZXQgb2xkVGltZVRvID0gb3V0T2ZXb3JrVGltZVJlY29yZC4kdGltZV90by5hdHRyKCd2YWx1ZScpO1xuICAgICAgICAgICAgICAgIGlmIChuZXdUaW1lVG8gIT09IG51bGwgJiYgb2xkVGltZVRvICE9PSAnJykge1xuICAgICAgICAgICAgICAgICAgICBvbGRUaW1lVG8gPSBuZXcgRGF0ZShvbGRUaW1lVG8gKiAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKChuZXdUaW1lVG8gLSBvbGRUaW1lVG8pICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLiR0aW1lX3RvLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgRm9ybS5kYXRhQ2hhbmdlZCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgYWN0aW9uIGRyb3Bkb3duXG4gICAgICAgICQoJyNhY3Rpb24nKVxuICAgICAgICAgICAgLmRyb3Bkb3duKHtcbiAgICAgICAgICAgICAgICBvbkNoYW5nZSgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBjaGFuZ2UgZXZlbnQgZm9yIHRoZSBhY3Rpb24gZHJvcGRvd25cbiAgICAgICAgICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC50b2dnbGVEaXNhYmxlZEZpZWxkQ2xhc3MoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIGNhbFR5cGUgZHJvcGRvd25cbiAgICAgICAgJCgnI2NhbFR5cGUnKVxuICAgICAgICAgICAgLmRyb3Bkb3duKHtcbiAgICAgICAgICAgICAgICBvbkNoYW5nZSgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBjaGFuZ2UgZXZlbnQgZm9yIHRoZSBhY3Rpb24gZHJvcGRvd25cbiAgICAgICAgICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC50b2dnbGVEaXNhYmxlZEZpZWxkQ2xhc3MoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgd2Vla2RheV9mcm9tIGRyb3Bkb3duXG4gICAgICAgICQoJyN3ZWVrZGF5X2Zyb20nKVxuICAgICAgICAgICAgLmRyb3Bkb3duKHtcbiAgICAgICAgICAgICAgICBvbkNoYW5nZSgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBjaGFuZ2UgZXZlbnQgZm9yIHRoZSB3ZWVrZGF5X2Zyb20gZHJvcGRvd25cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnJvbSA9IG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlJywgJ3dlZWtkYXlfZnJvbScpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0byA9IG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlJywgJ3dlZWtkYXlfdG8nKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZyb20gPCB0byB8fCB0byA9PT0gLTEgfHwgZnJvbSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmouZm9ybSgnc2V0IHZhbHVlJywgJ3dlZWtkYXlfdG8nLCBmcm9tKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSB3ZWVrZGF5X3RvIGRyb3Bkb3duXG4gICAgICAgICQoJyN3ZWVrZGF5X3RvJylcbiAgICAgICAgICAgIC5kcm9wZG93bih7XG4gICAgICAgICAgICAgICAgb25DaGFuZ2UoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEhhbmRsZSB0aGUgY2hhbmdlIGV2ZW50IGZvciB0aGUgd2Vla2RheV90byBkcm9wZG93blxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmcm9tID0gb3V0T2ZXb3JrVGltZVJlY29yZC4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWUnLCAnd2Vla2RheV9mcm9tJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvID0gb3V0T2ZXb3JrVGltZVJlY29yZC4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWUnLCAnd2Vla2RheV90bycpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodG8gPCBmcm9tIHx8IGZyb20gPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLiRmb3JtT2JqLmZvcm0oJ3NldCB2YWx1ZScsICd3ZWVrZGF5X2Zyb20nLCB0byk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQmluZCBjbGljayBldmVudCB0byBlcmFzZS1kYXRlcyBidXR0b25cbiAgICAgICAgJCgnI2VyYXNlLWRhdGVzJykub24oJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgICAgICAgIC8vIEhhbmRsZSB0aGUgY2xpY2sgZXZlbnQgZm9yIGVyYXNlLWRhdGVzIGJ1dHRvblxuICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VEYXlzU3RhcnQuY2FsZW5kYXIoJ2NsZWFyJyk7XG4gICAgICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLiRyYW5nZURheXNFbmQuY2FsZW5kYXIoJ2NsZWFyJyk7XG4gICAgICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLiRmb3JtT2JqXG4gICAgICAgICAgICAgICAgLmZvcm0oJ3NldCB2YWx1ZXMnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGVfZnJvbTogJycsXG4gICAgICAgICAgICAgICAgICAgIGRhdGVfdG86ICcnLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBCaW5kIGNsaWNrIGV2ZW50IHRvIGVyYXNlLXdlZWtkYXlzIGJ1dHRvblxuICAgICAgICAkKCcjZXJhc2Utd2Vla2RheXMnKS5vbignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBjbGljayBldmVudCBmb3IgZXJhc2Utd2Vla2RheXMgYnV0dG9uXG4gICAgICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLiRmb3JtT2JqXG4gICAgICAgICAgICAgICAgLmZvcm0oJ3NldCB2YWx1ZXMnLCB7XG4gICAgICAgICAgICAgICAgICAgIHdlZWtkYXlfZnJvbTogLTEsXG4gICAgICAgICAgICAgICAgICAgIHdlZWtkYXlfdG86IC0xLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VEYXlzU3RhcnQudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEJpbmQgY2xpY2sgZXZlbnQgdG8gZXJhc2UtdGltZXBlcmlvZCBidXR0b25cbiAgICAgICAgJCgnI2VyYXNlLXRpbWVwZXJpb2QnKS5vbignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBjbGljayBldmVudCBmb3IgZXJhc2UtdGltZXBlcmlvZCBidXR0b25cbiAgICAgICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQuJHJhbmdlVGltZVN0YXJ0LmNhbGVuZGFyKCdjbGVhcicpO1xuICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VUaW1lRW5kLmNhbGVuZGFyKCdjbGVhcicpO1xuICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kdGltZV90by50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBhdWRpby1tZXNzYWdlLXNlbGVjdCBkcm9wZG93blxuICAgICAgICAkKCcjc2F2ZS1vdXRvZmZ3b3JrLWZvcm0gLmF1ZGlvLW1lc3NhZ2Utc2VsZWN0JykuZHJvcGRvd24oU291bmRGaWxlc1NlbGVjdG9yLmdldERyb3Bkb3duU2V0dGluZ3NXaXRoRW1wdHkoKSk7XG5cbiAgICAgICAgLy8gQ2hhbmdlIHRoZSBkYXRlIGZvcm1hdCBmcm9tIGxpbnV4dGltZSB0byBsb2NhbCByZXByZXNlbnRhdGlvblxuICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLmNoYW5nZURhdGVGb3JtYXQoKTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBmb3JtXG4gICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQuaW5pdGlhbGl6ZUZvcm0oKTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBmb3J3YXJkaW5nU2VsZWN0RHJvcGRvd25cbiAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kZm9yd2FyZGluZ1NlbGVjdERyb3Bkb3duLmRyb3Bkb3duKEV4dGVuc2lvbnMuZ2V0RHJvcGRvd25TZXR0aW5nc1dpdGhvdXRFbXB0eSgpKTtcblxuICAgICAgICAvLyBUb2dnbGUgZGlzYWJsZWQgZmllbGQgY2xhc3MgYmFzZWQgb24gYWN0aW9uIHZhbHVlXG4gICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQudG9nZ2xlRGlzYWJsZWRGaWVsZENsYXNzKCk7XG5cbiAgICAgICAgLy8gQmluZCBjaGVja2JveCBjaGFuZ2UgZXZlbnQgZm9yIGluYm91bmQgcnVsZXMgdGFibGVcbiAgICAgICAgJCgnI2luYm91bmQtcnVsZXMtdGFibGUgLnVpLmNoZWNrYm94JykuY2hlY2tib3goe1xuICAgICAgICAgICAgb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsZXQgbmV3U3RhdGUgPSAndW5jaGVja2VkJztcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgdGhlIGNoYW5nZSBldmVudCBmb3IgaW5ib3VuZCBydWxlcyB0YWJsZSBjaGVja2JveFxuICAgICAgICAgICAgICAgIGlmICgkKHRoaXMpLnBhcmVudCgpLmNoZWNrYm94KCdpcyBjaGVja2VkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3U3RhdGUgPSAnY2hlY2tlZCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBkaWQgPSAkKHRoaXMpLnBhcmVudCgpLmF0dHIoJ2RhdGEtZGlkJyk7XG4gICAgICAgICAgICAgICAgbGV0IGZpbHRlciA9ICcjaW5ib3VuZC1ydWxlcy10YWJsZSAudWkuY2hlY2tib3hbZGF0YS1jb250ZXh0LWlkPScgKyAkKHRoaXMpLnBhcmVudCgpLmF0dHIoJ2RhdGEtY29udGV4dC1pZCcpICsgJ10nO1xuICAgICAgICAgICAgICAgIGlmKGRpZCAhPT0gJycgJiYgbmV3U3RhdGUgPT09ICdjaGVja2VkJyl7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlciA9IGZpbHRlciArICcudWkuY2hlY2tib3hbZGF0YS1kaWQ9JytkaWQrJ10nO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGRpZCAhPT0gJycgJiYgbmV3U3RhdGUgPT09ICd1bmNoZWNrZWQnKXtcbiAgICAgICAgICAgICAgICAgICAgJChmaWx0ZXIgKyAnLnVpLmNoZWNrYm94W2RhdGEtZGlkPVwiJytkaWQrJ1wiXScpLmNoZWNrYm94KCdzZXQgJytuZXdTdGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlciA9IGZpbHRlciArICcudWkuY2hlY2tib3hbZGF0YS1kaWQ9XCJcIl0nO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGRpZCA9PT0gJycgJiYgbmV3U3RhdGUgPT09ICd1bmNoZWNrZWQnKXtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gZmlsdGVyICsgJy51aS5jaGVja2JveFtkYXRhLWRpZD1cIlwiXSc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICQoZmlsdGVyKS5jaGVja2JveCgnc2V0ICcrbmV3U3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBCaW5kIGNoZWNrYm94IGNoYW5nZSBldmVudCBmb3IgYWxsb3dSZXN0cmljdGlvbiBjaGVja2JveFxuICAgICAgICAkKCcjYWxsb3dSZXN0cmljdGlvbicpLnBhcmVudCgpLmNoZWNrYm94KHtcbiAgICAgICAgICAgIG9uQ2hhbmdlOiBvdXRPZldvcmtUaW1lUmVjb3JkLmNoYW5nZVJlc3RyaWN0aW9uXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENhbGwgY2hhbmdlUmVzdHJpY3Rpb24gbWV0aG9kXG4gICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQuY2hhbmdlUmVzdHJpY3Rpb24oKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlcyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgJ3J1bGVzJyB0YWIgYmFzZWQgb24gdGhlIGNoZWNrZWQgc3RhdHVzIG9mIHRoZSAnYWxsb3dSZXN0cmljdGlvbicgY2hlY2tib3guXG4gICAgICovXG4gICAgY2hhbmdlUmVzdHJpY3Rpb24oKSB7XG4gICAgICAgIGlmICgkKCcjYWxsb3dSZXN0cmljdGlvbicpLnBhcmVudCgpLmNoZWNrYm94KCdpcyBjaGVja2VkJykpIHtcbiAgICAgICAgICAgICQoXCJhW2RhdGEtdGFiPSdydWxlcyddXCIpLnNob3coKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICQoXCJhW2RhdGEtdGFiPSdydWxlcyddXCIpLmhpZGUoKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgZGF0ZSBmb3JtYXQgZnJvbSBsaW51eHRpbWUgdG8gdGhlIGxvY2FsIHJlcHJlc2VudGF0aW9uLlxuICAgICAqL1xuICAgIGNoYW5nZURhdGVGb3JtYXQoKSB7XG4gICAgICAgIGNvbnN0IGRhdGVGcm9tID0gb3V0T2ZXb3JrVGltZVJlY29yZC4kZGF0ZV9mcm9tLmF0dHIoJ3ZhbHVlJyk7XG4gICAgICAgIGNvbnN0IGRhdGVUbyA9IG91dE9mV29ya1RpbWVSZWNvcmQuJGRhdGVfdG8uYXR0cigndmFsdWUnKTtcbiAgICAgICAgY29uc3QgY3VycmVudE9mZnNldCA9IG5ldyBEYXRlKCkuZ2V0VGltZXpvbmVPZmZzZXQoKTtcbiAgICAgICAgY29uc3Qgc2VydmVyT2Zmc2V0ID0gcGFyc2VJbnQob3V0T2ZXb3JrVGltZVJlY29yZC4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWUnLCAnc2VydmVyT2Zmc2V0JykpO1xuICAgICAgICBjb25zdCBvZmZzZXREaWZmID0gc2VydmVyT2Zmc2V0ICsgY3VycmVudE9mZnNldDtcbiAgICAgICAgaWYgKGRhdGVGcm9tICE9PSB1bmRlZmluZWQgJiYgZGF0ZUZyb20ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgZGF0ZUZyb21JbkJyb3dzZXJUWiA9IGRhdGVGcm9tICogMTAwMCArIG9mZnNldERpZmYgKiA2MCAqIDEwMDA7XG4gICAgICAgICAgICBvdXRPZldvcmtUaW1lUmVjb3JkLiRyYW5nZURheXNTdGFydC5jYWxlbmRhcignc2V0IGRhdGUnLCBuZXcgRGF0ZShkYXRlRnJvbUluQnJvd3NlclRaKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGVUbyAhPT0gdW5kZWZpbmVkICYmIGRhdGVUby5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRlVG9JbkJyb3dzZXJUWiA9IGRhdGVUbyAqIDEwMDAgKyBvZmZzZXREaWZmICogNjAgKiAxMDAwO1xuICAgICAgICAgICAgb3V0T2ZXb3JrVGltZVJlY29yZC4kcmFuZ2VEYXlzRW5kLmNhbGVuZGFyKCdzZXQgZGF0ZScsIG5ldyBEYXRlKGRhdGVUb0luQnJvd3NlclRaKSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyB0aGUgdmlzaWJpbGl0eSBvZiBjZXJ0YWluIGZpZWxkIGdyb3VwcyBiYXNlZCBvbiB0aGUgc2VsZWN0ZWQgYWN0aW9uIHZhbHVlLlxuICAgICAqL1xuICAgIHRvZ2dsZURpc2FibGVkRmllbGRDbGFzcygpIHtcbiAgICAgICAgaWYob3V0T2ZXb3JrVGltZVJlY29yZC4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWUnLCAnYWN0aW9uJykgPT09ICdleHRlbnNpb24nKSB7XG4gICAgICAgICAgICAkKCcjZXh0ZW5zaW9uLWdyb3VwJykuc2hvdygpO1xuICAgICAgICAgICAgJCgnI2F1ZGlvLWZpbGUtZ3JvdXAnKS5oaWRlKCk7XG4gICAgICAgICAgICAkKCcjYXVkaW9fbWVzc2FnZV9pZCcpLmRyb3Bkb3duKCdjbGVhcicpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICQoJyNleHRlbnNpb24tZ3JvdXAnKS5oaWRlKCk7XG4gICAgICAgICAgICAkKCcjYXVkaW8tZmlsZS1ncm91cCcpLnNob3coKTtcbiAgICAgICAgICAgIG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmouZm9ybSgnc2V0IHZhbHVlJywgJ2V4dGVuc2lvbicsIC0xKTtcbiAgICAgICAgfVxuICAgICAgICBpZihvdXRPZldvcmtUaW1lUmVjb3JkLiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZScsICdjYWxUeXBlJykgPT09ICdub25lJyl7XG4gICAgICAgICAgICAkKCcjY2FsbC10eXBlLW1haW4tdGFiJykuc2hvdygpO1xuICAgICAgICAgICAgJCgnI2NhbGwtdHlwZS1jYWxlbmRhci10YWInKS5oaWRlKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgJCgnI2NhbGwtdHlwZS1tYWluLXRhYicpLmhpZGUoKTtcbiAgICAgICAgICAgICQoJyNjYWxsLXR5cGUtY2FsZW5kYXItdGFiJykuc2hvdygpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmb3JtIHZhbGlkYXRpb24gZm9yIHZhbGlkYXRpbmcgc3BlY2lmaWMgZmllbGRzIGluIGEgZm9ybS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHQgLSBUaGUgcmVzdWx0IG9iamVjdCBjb250YWluaW5nIGZvcm0gZGF0YS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbnxPYmplY3R9IFJldHVybnMgZmFsc2UgaWYgdmFsaWRhdGlvbiBmYWlscywgb3IgdGhlIHJlc3VsdCBvYmplY3QgaWYgdmFsaWRhdGlvbiBwYXNzZXMuXG4gICAgICovXG4gICAgY3VzdG9tVmFsaWRhdGVGb3JtKHJlc3VsdCkge1xuICAgICAgICAvLyBDaGVjayBkYXRlIGZpZWxkc1xuICAgICAgICBpZiAoKHJlc3VsdC5kYXRhLmRhdGVfZnJvbSAhPT0gJycgJiYgcmVzdWx0LmRhdGEuZGF0ZV90byA9PT0gJycpXG4gICAgICAgICAgICB8fCAocmVzdWx0LmRhdGEuZGF0ZV90byAhPT0gJycgJiYgcmVzdWx0LmRhdGEuZGF0ZV9mcm9tID09PSAnJykpIHtcbiAgICAgICAgICAgICQoJy5mb3JtIC5lcnJvci5tZXNzYWdlJykuaHRtbChnbG9iYWxUcmFuc2xhdGUudGZfVmFsaWRhdGVDaGVja0RhdGVJbnRlcnZhbCkuc2hvdygpO1xuICAgICAgICAgICAgRm9ybS4kc3VibWl0QnV0dG9uLnRyYW5zaXRpb24oJ3NoYWtlJykucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIHdlZWtkYXkgZmllbGRzXG4gICAgICAgIGlmICgocmVzdWx0LmRhdGEud2Vla2RheV9mcm9tID4gMCAmJiByZXN1bHQuZGF0YS53ZWVrZGF5X3RvID09PSAnLTEnKVxuICAgICAgICAgICAgfHwgKHJlc3VsdC5kYXRhLndlZWtkYXlfdG8gPiAwICYmIHJlc3VsdC5kYXRhLndlZWtkYXlfZnJvbSA9PT0gJy0xJykpIHtcbiAgICAgICAgICAgICQoJy5mb3JtIC5lcnJvci5tZXNzYWdlJykuaHRtbChnbG9iYWxUcmFuc2xhdGUudGZfVmFsaWRhdGVDaGVja1dlZWtEYXlJbnRlcnZhbCkuc2hvdygpO1xuICAgICAgICAgICAgRm9ybS4kc3VibWl0QnV0dG9uLnRyYW5zaXRpb24oJ3NoYWtlJykucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcgZGlzYWJsZWQnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIHRpbWUgZmllbGRzXG4gICAgICAgIGlmICgocmVzdWx0LmRhdGEudGltZV9mcm9tLmxlbmd0aCA+IDAgJiYgcmVzdWx0LmRhdGEudGltZV90by5sZW5ndGggPT09IDApXG4gICAgICAgICAgICB8fCAocmVzdWx0LmRhdGEudGltZV90by5sZW5ndGggPiAwICYmIHJlc3VsdC5kYXRhLnRpbWVfZnJvbS5sZW5ndGggPT09IDApKSB7XG4gICAgICAgICAgICAkKCcuZm9ybSAuZXJyb3IubWVzc2FnZScpLmh0bWwoZ2xvYmFsVHJhbnNsYXRlLnRmX1ZhbGlkYXRlQ2hlY2tUaW1lSW50ZXJ2YWwpLnNob3coKTtcbiAgICAgICAgICAgIEZvcm0uJHN1Ym1pdEJ1dHRvbi50cmFuc2l0aW9uKCdzaGFrZScpLnJlbW92ZUNsYXNzKCdsb2FkaW5nIGRpc2FibGVkJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIHRpbWUgZmllbGQgZm9ybWF0XG4gICAgICAgIGlmICgocmVzdWx0LmRhdGEudGltZV9mcm9tLmxlbmd0aCA+IDAgJiYgcmVzdWx0LmRhdGEudGltZV90by5sZW5ndGggPT09IDApXG4gICAgICAgICAgICB8fCAocmVzdWx0LmRhdGEudGltZV90by5sZW5ndGggPiAwICYmIHJlc3VsdC5kYXRhLnRpbWVfZnJvbS5sZW5ndGggPT09IDApKSB7XG4gICAgICAgICAgICAkKCcuZm9ybSAuZXJyb3IubWVzc2FnZScpLmh0bWwoZ2xvYmFsVHJhbnNsYXRlLnRmX1ZhbGlkYXRlQ2hlY2tUaW1lSW50ZXJ2YWwpLnNob3coKTtcbiAgICAgICAgICAgIEZvcm0uJHN1Ym1pdEJ1dHRvbi50cmFuc2l0aW9uKCdzaGFrZScpLnJlbW92ZUNsYXNzKCdsb2FkaW5nIGRpc2FibGVkJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGFsbCBmaWVsZHNcbiAgICAgICAgaWYgKCQoJyNjYWxUeXBlJykucGFyZW50KCkuZHJvcGRvd24oJ2dldCB2YWx1ZScpID09PSAnbm9uZSdcbiAgICAgICAgICAgICYmIHJlc3VsdC5kYXRhLnRpbWVfZnJvbSA9PT0gJydcbiAgICAgICAgICAgICYmIHJlc3VsdC5kYXRhLnRpbWVfdG8gPT09ICcnXG4gICAgICAgICAgICAmJiByZXN1bHQuZGF0YS53ZWVrZGF5X2Zyb20gPT09ICctMSdcbiAgICAgICAgICAgICYmIHJlc3VsdC5kYXRhLndlZWtkYXlfdG8gPT09ICctMSdcbiAgICAgICAgICAgICYmIHJlc3VsdC5kYXRhLmRhdGVfZnJvbSA9PT0gJydcbiAgICAgICAgICAgICYmIHJlc3VsdC5kYXRhLmRhdGVfdG8gPT09ICcnKSB7XG4gICAgICAgICAgICAkKCcuZm9ybSAuZXJyb3IubWVzc2FnZScpLmh0bWwoZ2xvYmFsVHJhbnNsYXRlLnRmX1ZhbGlkYXRlTm9SdWxlc1NlbGVjdGVkKS5zaG93KCk7XG4gICAgICAgICAgICBGb3JtLiRzdWJtaXRCdXR0b24udHJhbnNpdGlvbignc2hha2UnKS5yZW1vdmVDbGFzcygnbG9hZGluZyBkaXNhYmxlZCcpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBiZWZvcmUgdGhlIGZvcm0gaXMgc2VudFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyAtIFRoZSBjdXJyZW50IHNldHRpbmdzIG9mIHRoZSBmb3JtXG4gICAgICogQHJldHVybnMge09iamVjdH0gLSBUaGUgdXBkYXRlZCBzZXR0aW5ncyBvZiB0aGUgZm9ybVxuICAgICAqL1xuICAgIGNiQmVmb3JlU2VuZEZvcm0oc2V0dGluZ3MpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gc2V0dGluZ3M7XG4gICAgICAgICQoJy5mb3JtIC5lcnJvci5tZXNzYWdlJykuaHRtbCgnJykuaGlkZSgpO1xuICAgICAgICByZXN1bHQuZGF0YSA9IG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlcycpO1xuICAgICAgICBjb25zdCBkYXRlRnJvbSA9IG91dE9mV29ya1RpbWVSZWNvcmQuJHJhbmdlRGF5c1N0YXJ0LmNhbGVuZGFyKCdnZXQgZGF0ZScpO1xuICAgICAgICBjb25zdCBkYXRlVG8gPSBvdXRPZldvcmtUaW1lUmVjb3JkLiRyYW5nZURheXNFbmQuY2FsZW5kYXIoJ2dldCBkYXRlJyk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRPZmZzZXQgPSBuZXcgRGF0ZSgpLmdldFRpbWV6b25lT2Zmc2V0KCk7XG4gICAgICAgIGNvbnN0IHNlcnZlck9mZnNldCA9IHBhcnNlSW50KG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlJywgJ3NlcnZlck9mZnNldCcpKTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0RGlmZiA9IHNlcnZlck9mZnNldCArIGN1cnJlbnRPZmZzZXQ7XG5cbiAgICAgICAgaWYoJCgnI2NhbFR5cGUnKS5wYXJlbnQoKS5kcm9wZG93bignZ2V0IHZhbHVlJykgPT09ICdub25lJyl7XG4gICAgICAgICAgICBGb3JtLnZhbGlkYXRlUnVsZXMudGltZWZyb20ucnVsZXMgPSBvdXRPZldvcmtUaW1lUmVjb3JkLmFkZGl0aW9uYWxUaW1lSW50ZXJ2YWxSdWxlcztcbiAgICAgICAgICAgIEZvcm0udmFsaWRhdGVSdWxlcy50aW1ldG8ucnVsZXMgPSBvdXRPZldvcmtUaW1lUmVjb3JkLmFkZGl0aW9uYWxUaW1lSW50ZXJ2YWxSdWxlcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIEZvcm0udmFsaWRhdGVSdWxlcy50aW1lZnJvbS5ydWxlcyA9IFtdO1xuICAgICAgICAgICAgRm9ybS52YWxpZGF0ZVJ1bGVzLnRpbWV0by5ydWxlcyA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGVGcm9tKSB7XG4gICAgICAgICAgICBkYXRlRnJvbS5zZXRIb3VycygwLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIHJlc3VsdC5kYXRhLmRhdGVfZnJvbSA9IE1hdGguZmxvb3IoZGF0ZUZyb20uZ2V0VGltZSgpLzEwMDApIC0gb2Zmc2V0RGlmZiAqIDYwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRlVG8pIHtcbiAgICAgICAgICAgIGRhdGVUby5zZXRIb3VycygyMywgNTksIDU5LCAwKTtcbiAgICAgICAgICAgIHJlc3VsdC5kYXRhLmRhdGVfdG8gPSBNYXRoLmZsb29yKGRhdGVUby5nZXRUaW1lKCkvMTAwMCkgLSBvZmZzZXREaWZmICogNjA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dE9mV29ya1RpbWVSZWNvcmQuY3VzdG9tVmFsaWRhdGVGb3JtKHJlc3VsdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhZnRlciB0aGUgZm9ybSBoYXMgYmVlbiBzZW50LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSAtIFRoZSByZXNwb25zZSBmcm9tIHRoZSBzZXJ2ZXIgYWZ0ZXIgdGhlIGZvcm0gaXMgc2VudFxuICAgICAqL1xuICAgIGNiQWZ0ZXJTZW5kRm9ybShyZXNwb25zZSkge1xuXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIGZvcm0gd2l0aCBjdXN0b20gc2V0dGluZ3NcbiAgICAgKi9cbiAgICBpbml0aWFsaXplRm9ybSgpIHtcbiAgICAgICAgRm9ybS4kZm9ybU9iaiA9IG91dE9mV29ya1RpbWVSZWNvcmQuJGZvcm1PYmo7XG4gICAgICAgIEZvcm0udXJsID0gYCR7Z2xvYmFsUm9vdFVybH1vdXQtb2ZmLXdvcmstdGltZS9zYXZlYDsgLy8gRm9ybSBzdWJtaXNzaW9uIFVSTFxuICAgICAgICBGb3JtLnZhbGlkYXRlUnVsZXMgPSBvdXRPZldvcmtUaW1lUmVjb3JkLnZhbGlkYXRlUnVsZXM7IC8vIEZvcm0gdmFsaWRhdGlvbiBydWxlc1xuICAgICAgICBGb3JtLmNiQmVmb3JlU2VuZEZvcm0gPSBvdXRPZldvcmtUaW1lUmVjb3JkLmNiQmVmb3JlU2VuZEZvcm07IC8vIENhbGxiYWNrIGJlZm9yZSBmb3JtIGlzIHNlbnRcbiAgICAgICAgRm9ybS5jYkFmdGVyU2VuZEZvcm0gPSBvdXRPZldvcmtUaW1lUmVjb3JkLmNiQWZ0ZXJTZW5kRm9ybTsgLy8gQ2FsbGJhY2sgYWZ0ZXIgZm9ybSBpcyBzZW50XG4gICAgICAgIEZvcm0uaW5pdGlhbGl6ZSgpO1xuICAgIH0sXG59O1xuXG4vKipcbiAqIEN1c3RvbSBmb3JtIHZhbGlkYXRpb24gcnVsZSB0aGF0IGNoZWNrcyBpZiBhIHZhbHVlIGlzIG5vdCBlbXB0eSBiYXNlZCBvbiBhIHNwZWNpZmljIGFjdGlvbi5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBUaGUgdmFsdWUgdG8gYmUgdmFsaWRhdGVkLlxuICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbiAtIFRoZSBhY3Rpb24gdG8gY29tcGFyZSBhZ2FpbnN0LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgdmFsdWUgaXMgbm90IGVtcHR5IG9yIHRoZSBhY3Rpb24gZG9lcyBub3QgbWF0Y2gsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuJC5mbi5mb3JtLnNldHRpbmdzLnJ1bGVzLmN1c3RvbU5vdEVtcHR5SWZBY3Rpb25SdWxlID0gKHZhbHVlLCBhY3Rpb24pID0+IHtcbiAgICBpZiAodmFsdWUubGVuZ3RoID09PSAwICYmICQoJyNhY3Rpb24nKS52YWwoKSA9PT0gYWN0aW9uKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqIEN1c3RvbSBmb3JtIHZhbGlkYXRpb24gcnVsZSB0aGF0IGNoZWNrcyBpZiBhIHZhbHVlIGlzIG5vdCBlbXB0eSBiYXNlZCBvbiBhIHNwZWNpZmljIGFjdGlvbi5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBUaGUgdmFsdWUgdG8gYmUgdmFsaWRhdGVkLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgdmFsdWUgaXMgbm90IGVtcHR5IG9yIHRoZSBhY3Rpb24gZG9lcyBub3QgbWF0Y2gsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuJC5mbi5mb3JtLnNldHRpbmdzLnJ1bGVzLmN1c3RvbU5vdEVtcHR5SWZDYWxUeXBlID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKCQoJyNjYWxUeXBlJykudmFsKCkgPT09ICdub25lJykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IHVybCA9IG5ldyBVUkwodmFsdWUpO1xuICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cblxuLyoqXG4gKiAgSW5pdGlhbGl6ZSBvdXQgb2Ygd29yayBmb3JtIG9uIGRvY3VtZW50IHJlYWR5XG4gKi9cbiQoZG9jdW1lbnQpLnJlYWR5KCgpID0+IHtcbiAgICBvdXRPZldvcmtUaW1lUmVjb3JkLmluaXRpYWxpemUoKTtcbn0pO1xuIl19