"use strict";

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

/* global globalTranslate, PbxApi, Form, globalRootUrl, Datatable, SemanticLocalization */

/**
 * The `fail2BanIndex` object contains methods and variables for managing the Fail2Ban system.
 *
 * @module fail2BanIndex
 */
var fail2BanIndex = {
  /**
   * jQuery object for the form.
   * @type {jQuery}
   */
  $formObj: $('#fail2ban-settings-form'),

  /**
   * The list of banned IPs
   * @type {jQuery}
   */
  $bannedIpListTable: $('#banned-ip-list-table'),

  /**
   * jQuery object Maximum number of requests.
   * @type {jQuery}
   */
  $maxReqSlider: $('#PBXFirewallMaxReqSec'),

  /**
   * Possible period values for the records retention.
   */
  maxReqValue: ['10', '30', '100', '300', '0'],

  /**
   * The list of banned IPs
   * @type {Datatable}
   */
  dataTable: null,

  /**
   * The unban buttons
   * @type {jQuery}
   */
  $unbanButtons: $('.unban-button'),

  /**
   * The global search input element.
   * @type {jQuery}
   */
  $globalSearch: $('#global-search'),

  /**
   * Validation rules for the form fields before submission.
   *
   * @type {object}
   */
  validateRules: {
    maxretry: {
      identifier: 'maxretry',
      rules: [{
        type: 'integer[3..99]',
        prompt: globalTranslate.f2b_ValidateMaxRetryRange
      }]
    },
    findtime: {
      identifier: 'findtime',
      rules: [{
        type: 'integer[300..86400]',
        prompt: globalTranslate.f2b_ValidateFindTimeRange
      }]
    },
    bantime: {
      identifier: 'bantime',
      rules: [{
        type: 'integer[300..259200]',
        prompt: globalTranslate.f2b_ValidateBanTimeRange
      }]
    }
  },
  // This method initializes the Fail2Ban management interface.
  initialize: function initialize() {
    $('#fail2ban-tab-menu .item').tab();
    fail2BanIndex.initializeDataTable();
    fail2BanIndex.initializeForm();
    PbxApi.FirewallGetBannedIp(fail2BanIndex.cbGetBannedIpList);
    fail2BanIndex.$bannedIpListTable.on('click', fail2BanIndex.$unbanButtons, function (e) {
      var unbannedIp = $(e.target).attr('data-value');
      fail2BanIndex.$bannedIpListTable.addClass('loading');
      PbxApi.FirewallUnBanIp(unbannedIp, fail2BanIndex.cbAfterUnBanIp);
    }); // Initialize records save period slider

    fail2BanIndex.$maxReqSlider.slider({
      min: 0,
      max: 4,
      step: 1,
      smooth: true,
      interpretLabel: function interpretLabel(value) {
        var labels = [globalTranslate.f2b_MaxReqSec10, globalTranslate.f2b_MaxReqSec30, globalTranslate.f2b_MaxReqSec100, globalTranslate.f2b_MaxReqSec300, globalTranslate.gs_StoreAllPossibleRecords];
        return labels[value];
      },
      onChange: fail2BanIndex.cbAfterSelectMaxReqSlider
    });
    var maxReq = fail2BanIndex.$formObj.form('get value', 'PBXFirewallMaxReqSec');
    fail2BanIndex.$maxReqSlider.slider('set value', fail2BanIndex.maxReqValue.indexOf(maxReq), false);
  },

  /**
   * Handle event after the select save period slider is changed.
   * @param {number} value - The selected value from the slider.
   */
  cbAfterSelectMaxReqSlider: function cbAfterSelectMaxReqSlider(value) {
    // Get the save period corresponding to the slider value.
    var maxReq = fail2BanIndex.maxReqValue[value]; // Set the form value for 'PBXRecordSavePeriod' to the selected save period.

    fail2BanIndex.$formObj.form('set value', 'PBXFirewallMaxReqSec', maxReq); // Trigger change event to acknowledge the modification

    Form.dataChanged();
  },

  /**
   * Initialize data table on the page
   *
   */
  initializeDataTable: function initializeDataTable() {
    $('#fail2ban-tab-menu .item').tab({
      onVisible: function onVisible() {
        if ($(this).data('tab') === 'banned' && fail2BanIndex.dataTable !== null) {
          var newPageLength = fail2BanIndex.calculatePageLength();
          fail2BanIndex.dataTable.page.len(newPageLength).draw(false);
        }
      }
    });
    fail2BanIndex.dataTable = fail2BanIndex.$bannedIpListTable.DataTable({
      // destroy: true,
      lengthChange: false,
      paging: true,
      pageLength: fail2BanIndex.calculatePageLength(),
      scrollCollapse: true,
      deferRender: true,
      columns: [// IP
      {
        orderable: true,
        // This column is orderable
        searchable: true // This column is searchable

      }, // Reason
      {
        orderable: false,
        // This column is not orderable
        searchable: false // This column is not searchable

      }, // Buttons
      {
        orderable: false,
        // This column is orderable
        searchable: false // This column is searchable

      }],
      order: [0, 'asc'],
      language: SemanticLocalization.dataTableLocalisation,

      /**
       * Constructs the Extensions row.
       * @param {HTMLElement} row - The row element.
       * @param {Array} data - The row data.
       */
      createdRow: function createdRow(row, data) {
        $('td', row).eq(0).addClass('collapsing');
        $('td', row).eq(2).addClass('collapsing');
      }
    });
  },
  // This callback method is used to display the list of banned IPs.
  cbGetBannedIpList: function cbGetBannedIpList(response) {
    fail2BanIndex.$bannedIpListTable.removeClass('loading');

    if (response === false) {
      return;
    } // Clear the DataTable


    fail2BanIndex.dataTable.clear(); // Prepare the new data to be added

    var newData = [];
    Object.keys(response).forEach(function (ip) {
      var bans = response[ip]; // Combine all reasons and dates for this IP into one string

      var reasonsDatesCombined = bans.map(function (ban) {
        var blockDate = new Date(ban.timeofban * 1000).toLocaleString();
        var reason = "f2b_Jail_".concat(ban.jail);

        if (reason in globalTranslate) {
          reason = globalTranslate[reason];
        }

        return "".concat(reason, " - ").concat(blockDate);
      }).join('<br>'); // Use line breaks to separate each reason-date pair
      // Construct a row: IP, Combined Reasons and Dates, Unban Button

      var row = [ip, reasonsDatesCombined, "<button class=\"ui icon basic mini button right floated unban-button\" data-value=\"".concat(ip, "\"><i class=\"icon trash red\"></i>").concat(globalTranslate.f2b_Unban, "</button>")];
      newData.push(row);
    }); // Add the new data and redraw the table

    fail2BanIndex.dataTable.rows.add(newData).draw();
  },
  // This callback method is used after an IP has been unbanned.
  cbAfterUnBanIp: function cbAfterUnBanIp() {
    PbxApi.FirewallGetBannedIp(fail2BanIndex.cbGetBannedIpList);
  },

  /**
   * Callback function to be called before the form is sent
   * @param {Object} settings - The current settings of the form
   * @returns {Object} - The updated settings of the form
   */
  cbBeforeSendForm: function cbBeforeSendForm(settings) {
    var result = settings;
    result.data = fail2BanIndex.$formObj.form('get values');
    return result;
  },

  /**
   * Callback function to be called after the form has been sent.
   * @param {Object} response - The response from the server after the form is sent
   */
  cbAfterSendForm: function cbAfterSendForm(response) {},

  /**
   * Calculate data table page length
   *
   * @returns {number}
   */
  calculatePageLength: function calculatePageLength() {
    // Calculate row height
    var rowHeight = fail2BanIndex.$bannedIpListTable.find('tr').last().outerHeight(); // Calculate window height and available space for table

    var windowHeight = window.innerHeight;
    var headerFooterHeight = 400; // Estimate height for header, footer, and other elements
    // Calculate new page length

    return Math.max(Math.floor((windowHeight - headerFooterHeight) / rowHeight), 10);
  },

  /**
   * Initialize the form with custom settings
   */
  initializeForm: function initializeForm() {
    Form.$formObj = fail2BanIndex.$formObj;
    Form.url = "".concat(globalRootUrl, "fail2-ban/save"); // Form submission URL

    Form.validateRules = fail2BanIndex.validateRules; // Form validation rules

    Form.cbBeforeSendForm = fail2BanIndex.cbBeforeSendForm; // Callback before form is sent

    Form.cbAfterSendForm = fail2BanIndex.cbAfterSendForm; // Callback after form is sent

    Form.initialize();
  }
}; // When the document is ready, initialize the Fail2Ban management interface.

$(document).ready(function () {
  fail2BanIndex.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9GYWlsMkJhbi9mYWlsLXRvLWJhbi1pbmRleC5qcyJdLCJuYW1lcyI6WyJmYWlsMkJhbkluZGV4IiwiJGZvcm1PYmoiLCIkIiwiJGJhbm5lZElwTGlzdFRhYmxlIiwiJG1heFJlcVNsaWRlciIsIm1heFJlcVZhbHVlIiwiZGF0YVRhYmxlIiwiJHVuYmFuQnV0dG9ucyIsIiRnbG9iYWxTZWFyY2giLCJ2YWxpZGF0ZVJ1bGVzIiwibWF4cmV0cnkiLCJpZGVudGlmaWVyIiwicnVsZXMiLCJ0eXBlIiwicHJvbXB0IiwiZ2xvYmFsVHJhbnNsYXRlIiwiZjJiX1ZhbGlkYXRlTWF4UmV0cnlSYW5nZSIsImZpbmR0aW1lIiwiZjJiX1ZhbGlkYXRlRmluZFRpbWVSYW5nZSIsImJhbnRpbWUiLCJmMmJfVmFsaWRhdGVCYW5UaW1lUmFuZ2UiLCJpbml0aWFsaXplIiwidGFiIiwiaW5pdGlhbGl6ZURhdGFUYWJsZSIsImluaXRpYWxpemVGb3JtIiwiUGJ4QXBpIiwiRmlyZXdhbGxHZXRCYW5uZWRJcCIsImNiR2V0QmFubmVkSXBMaXN0Iiwib24iLCJlIiwidW5iYW5uZWRJcCIsInRhcmdldCIsImF0dHIiLCJhZGRDbGFzcyIsIkZpcmV3YWxsVW5CYW5JcCIsImNiQWZ0ZXJVbkJhbklwIiwic2xpZGVyIiwibWluIiwibWF4Iiwic3RlcCIsInNtb290aCIsImludGVycHJldExhYmVsIiwidmFsdWUiLCJsYWJlbHMiLCJmMmJfTWF4UmVxU2VjMTAiLCJmMmJfTWF4UmVxU2VjMzAiLCJmMmJfTWF4UmVxU2VjMTAwIiwiZjJiX01heFJlcVNlYzMwMCIsImdzX1N0b3JlQWxsUG9zc2libGVSZWNvcmRzIiwib25DaGFuZ2UiLCJjYkFmdGVyU2VsZWN0TWF4UmVxU2xpZGVyIiwibWF4UmVxIiwiZm9ybSIsImluZGV4T2YiLCJGb3JtIiwiZGF0YUNoYW5nZWQiLCJvblZpc2libGUiLCJkYXRhIiwibmV3UGFnZUxlbmd0aCIsImNhbGN1bGF0ZVBhZ2VMZW5ndGgiLCJwYWdlIiwibGVuIiwiZHJhdyIsIkRhdGFUYWJsZSIsImxlbmd0aENoYW5nZSIsInBhZ2luZyIsInBhZ2VMZW5ndGgiLCJzY3JvbGxDb2xsYXBzZSIsImRlZmVyUmVuZGVyIiwiY29sdW1ucyIsIm9yZGVyYWJsZSIsInNlYXJjaGFibGUiLCJvcmRlciIsImxhbmd1YWdlIiwiU2VtYW50aWNMb2NhbGl6YXRpb24iLCJkYXRhVGFibGVMb2NhbGlzYXRpb24iLCJjcmVhdGVkUm93Iiwicm93IiwiZXEiLCJyZXNwb25zZSIsInJlbW92ZUNsYXNzIiwiY2xlYXIiLCJuZXdEYXRhIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJpcCIsImJhbnMiLCJyZWFzb25zRGF0ZXNDb21iaW5lZCIsIm1hcCIsImJhbiIsImJsb2NrRGF0ZSIsIkRhdGUiLCJ0aW1lb2ZiYW4iLCJ0b0xvY2FsZVN0cmluZyIsInJlYXNvbiIsImphaWwiLCJqb2luIiwiZjJiX1VuYmFuIiwicHVzaCIsInJvd3MiLCJhZGQiLCJjYkJlZm9yZVNlbmRGb3JtIiwic2V0dGluZ3MiLCJyZXN1bHQiLCJjYkFmdGVyU2VuZEZvcm0iLCJyb3dIZWlnaHQiLCJmaW5kIiwibGFzdCIsIm91dGVySGVpZ2h0Iiwid2luZG93SGVpZ2h0Iiwid2luZG93IiwiaW5uZXJIZWlnaHQiLCJoZWFkZXJGb290ZXJIZWlnaHQiLCJNYXRoIiwiZmxvb3IiLCJ1cmwiLCJnbG9iYWxSb290VXJsIiwiZG9jdW1lbnQiLCJyZWFkeSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFNQSxhQUFhLEdBQUc7QUFFbEI7QUFDSjtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsUUFBUSxFQUFFQyxDQUFDLENBQUMseUJBQUQsQ0FOTzs7QUFRbEI7QUFDSjtBQUNBO0FBQ0E7QUFDSUMs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T0MsSUFBSSxDQUFDNUUsR0FBTCxDQUFTNEUsSUFBSSxDQUFDQyxLQUFMLENBQVcsQ0FBQ0wsWUFBWSxHQUFHRyxrQkFBaEIsSUFBc0NQLFNBQWpELENBQVQsRUFBc0UsRUFBdEUsQ0FBUDtBQUNILEdBalFpQjs7QUFtUWxCO0FBQ0o7QUFDQTtBQUNJbEYsRUFBQUEsY0F0UWtCLDRCQXNRRDtBQUNiOEIsSUFBQUEsSUFBSSxDQUFDckQsUUFBTCxHQUFnQkQsYUFBYSxDQUFDQyxRQUE5QjtBQUNBcUQsSUFBQUEsSUFBSSxDQUFDOEQsR0FBTCxhQUFjQyxhQUFkLG9CQUZhLENBRWdDOztBQUM3Qy9ELElBQUFBLElBQUksQ0FBQzdDLGFBQUwsR0FBcUJULGFBQWEsQ0FBQ1MsYUFBbkMsQ0FIYSxDQUdxQzs7QUFDbEQ2QyxJQUFBQSxJQUFJLENBQUNnRCxnQkFBTCxHQUF3QnRHLGFBQWEsQ0FBQ3NHLGdCQUF0QyxDQUphLENBSTJDOztBQUN4RGhELElBQUFBLElBQUksQ0FBQ21ELGVBQUwsR0FBdUJ6RyxhQUFhLENBQUN5RyxlQUFyQyxDQUxhLENBS3lDOztBQUN0RG5ELElBQUFBLElBQUksQ0FBQ2pDLFVBQUw7QUFDSDtBQTdRaUIsQ0FBdEIsQyxDQWdSQTs7QUFDQW5CLENBQUMsQ0FBQ29ILFFBQUQsQ0FBRCxDQUFZQyxLQUFaLENBQWtCLFlBQU07QUFDcEJ2SCxFQUFBQSxhQUFhLENBQUNxQixVQUFkO0FBQ0gsQ0FGRCIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBNaWtvUEJYIC0gZnJlZSBwaG9uZSBzeXN0ZW0gZm9yIHNtYWxsIGJ1c2luZXNzXG4gKiBDb3B5cmlnaHQgwqkgMjAxNy0yMDI0IEFsZXhleSBQb3J0bm92IGFuZCBOaWtvbGF5IEJla2V0b3ZcbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuICogaXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnlcbiAqIHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb247IGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG4gKiAoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuICogYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2ZcbiAqIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcbiAqIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cHM6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuICovXG5cbi8qIGdsb2JhbCBnbG9iYWxUcmFuc2xhdGUsIFBieEFwaSwgRm9ybSwgZ2xvYmFsUm9vdFVybCwgRGF0YXRhYmxlLCBTZW1hbnRpY0xvY2FsaXphdGlvbiAqL1xuLyoqXG4gKiBUaGUgYGZhaWwyQmFuSW5kZXhgIG9iamVjdCBjb250YWlucyBtZXRob2RzIGFuZCB2YXJpYWJsZXMgZm9yIG1hbmFnaW5nIHRoZSBGYWlsMkJhbiBzeXN0ZW0uXG4gKlxuICogQG1vZHVsZSBmYWlsMkJhbkluZGV4XG4gKi9cbmNvbnN0IGZhaWwyQmFuSW5kZXggPSB7XG5cbiAgICAvKipcbiAgICAgKiBqUXVlcnkgb2JqZWN0IGZvciB0aGUgZm9ybS5cbiAgICAgKiBAdHlwZSB7alF1ZXJ5fVxuICAgICAqL1xuICAgICRmb3JtT2JqOiAkKCcjZmFpbDJiYW4tc2V0dGluZ3MtZm9ybScpLFxuXG4gICAgLyoqXG4gICAgICogVGhlIGxpc3Qgb2YgYmFubmVkIElQc1xuICAgICAqIEB0eXBlIHtqUXVlcnl9XG4gICAgICovXG4gICAgJGJhbm5lZElwTGlzdFRhYmxlOiAkKCcjYmFubmVkLWlwLWxpc3QtdGFibGUnKSxcblxuICAgIC8qKlxuICAgICAqIGpRdWVyeSBvYmplY3QgTWF4aW11bSBudW1iZXIgb2YgcmVxdWVzdHMuXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkbWF4UmVxU2xpZGVyOiAkKCcjUEJYRmlyZXdhbGxNYXhSZXFTZWMnKSxcblxuICAgIC8qKlxuICAgICAqIFBvc3NpYmxlIHBlcmlvZCB2YWx1ZXMgZm9yIHRoZSByZWNvcmRzIHJldGVudGlvbi5cbiAgICAgKi9cbiAgICBtYXhSZXFWYWx1ZTogWycxMCcsICczMCcsICcxMDAnLCAnMzAwJywgJzAnXSxcblxuICAgIC8qKlxuICAgICAqIFRoZSBsaXN0IG9mIGJhbm5lZCBJUHNcbiAgICAgKiBAdHlwZSB7RGF0YXRhYmxlfVxuICAgICAqL1xuICAgIGRhdGFUYWJsZTogbnVsbCxcblxuICAgIC8qKlxuICAgICAqIFRoZSB1bmJhbiBidXR0b25zXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkdW5iYW5CdXR0b25zOiAkKCcudW5iYW4tYnV0dG9uJyksXG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ2xvYmFsIHNlYXJjaCBpbnB1dCBlbGVtZW50LlxuICAgICAqIEB0eXBlIHtqUXVlcnl9XG4gICAgICovXG4gICAgJGdsb2JhbFNlYXJjaDogJCgnI2dsb2JhbC1zZWFyY2gnKSxcblxuICAgIC8qKlxuICAgICAqIFZhbGlkYXRpb24gcnVsZXMgZm9yIHRoZSBmb3JtIGZpZWxkcyBiZWZvcmUgc3VibWlzc2lvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgdmFsaWRhdGVSdWxlczoge1xuICAgICAgICBtYXhyZXRyeToge1xuICAgICAgICAgICAgaWRlbnRpZmllcjogJ21heHJldHJ5JyxcbiAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW50ZWdlclszLi45OV0nLFxuICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IGdsb2JhbFRyYW5zbGF0ZS5mMmJfVmFsaWRhdGVNYXhSZXRyeVJhbmdlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBmaW5kdGltZToge1xuICAgICAgICAgICAgaWRlbnRpZmllcjogJ2ZpbmR0aW1lJyxcbiAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW50ZWdlclszMDAuLjg2NDAwXScsXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLmYyYl9WYWxpZGF0ZUZpbmRUaW1lUmFuZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGJhbnRpbWU6IHtcbiAgICAgICAgICAgIGlkZW50aWZpZXI6ICdiYW50aW1lJyxcbiAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW50ZWdlclszMDAuLjI1OTIwMF0nLFxuICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IGdsb2JhbFRyYW5zbGF0ZS5mMmJfVmFsaWRhdGVCYW5UaW1lUmFuZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIC8vIFRoaXMgbWV0aG9kIGluaXRpYWxpemVzIHRoZSBGYWlsMkJhbiBtYW5hZ2VtZW50IGludGVyZmFjZS5cbiAgICBpbml0aWFsaXplKCkge1xuICAgICAgICAkKCcjZmFpbDJiYW4tdGFiLW1lbnUgLml0ZW0nKS50YWIoKTtcbiAgICAgICAgZmFpbDJCYW5JbmRleC5pbml0aWFsaXplRGF0YVRhYmxlKCk7XG4gICAgICAgIGZhaWwyQmFuSW5kZXguaW5pdGlhbGl6ZUZvcm0oKTtcblxuICAgICAgICBQYnhBcGkuRmlyZXdhbGxHZXRCYW5uZWRJcChmYWlsMkJhbkluZGV4LmNiR2V0QmFubmVkSXBMaXN0KTtcblxuICAgICAgICBmYWlsMkJhbkluZGV4LiRiYW5uZWRJcExpc3RUYWJsZS5vbignY2xpY2snLCBmYWlsMkJhbkluZGV4LiR1bmJhbkJ1dHRvbnMsIChlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB1bmJhbm5lZElwID0gJChlLnRhcmdldCkuYXR0cignZGF0YS12YWx1ZScpO1xuICAgICAgICAgICAgZmFpbDJCYW5JbmRleC4kYmFubmVkSXBMaXN0VGFibGUuYWRkQ2xhc3MoJ2xvYWRpbmcnKTtcbiAgICAgICAgICAgIFBieEFwaS5GaXJld2FsbFVuQmFuSXAodW5iYW5uZWRJcCwgZmFpbDJCYW5JbmRleC5jYkFmdGVyVW5CYW5JcCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcmVjb3JkcyBzYXZlIHBlcmlvZCBzbGlkZXJcbiAgICAgICAgZmFpbDJCYW5JbmRleC4kbWF4UmVxU2xpZGVyXG4gICAgICAgICAgICAuc2xpZGVyKHtcbiAgICAgICAgICAgICAgICBtaW46IDAsXG4gICAgICAgICAgICAgICAgbWF4OiA0LFxuICAgICAgICAgICAgICAgIHN0ZXA6IDEsXG4gICAgICAgICAgICAgICAgc21vb3RoOiB0cnVlLFxuICAgICAgICAgICAgICAgIGludGVycHJldExhYmVsOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGxhYmVscyA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsb2JhbFRyYW5zbGF0ZS5mMmJfTWF4UmVxU2VjMTAsXG4gICAgICAgICAgICAgICAgICAgICAgICBnbG9iYWxUcmFuc2xhdGUuZjJiX01heFJlcVNlYzMwLFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2xvYmFsVHJhbnNsYXRlLmYyYl9NYXhSZXFTZWMxMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBnbG9iYWxUcmFuc2xhdGUuZjJiX01heFJlcVNlYzMwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsb2JhbFRyYW5zbGF0ZS5nc19TdG9yZUFsbFBvc3NpYmxlUmVjb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxhYmVsc1t2YWx1ZV07XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBvbkNoYW5nZTogZmFpbDJCYW5JbmRleC5jYkFmdGVyU2VsZWN0TWF4UmVxU2xpZGVyLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgO1xuICAgICAgICBjb25zdCBtYXhSZXEgPSBmYWlsMkJhbkluZGV4LiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZScsICdQQlhGaXJld2FsbE1heFJlcVNlYycpO1xuICAgICAgICBmYWlsMkJhbkluZGV4LiRtYXhSZXFTbGlkZXJcbiAgICAgICAgICAgIC5zbGlkZXIoJ3NldCB2YWx1ZScsIGZhaWwyQmFuSW5kZXgubWF4UmVxVmFsdWUuaW5kZXhPZihtYXhSZXEpLCBmYWxzZSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSBldmVudCBhZnRlciB0aGUgc2VsZWN0IHNhdmUgcGVyaW9kIHNsaWRlciBpcyBjaGFuZ2VkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBzZWxlY3RlZCB2YWx1ZSBmcm9tIHRoZSBzbGlkZXIuXG4gICAgICovXG4gICAgY2JBZnRlclNlbGVjdE1heFJlcVNsaWRlcih2YWx1ZSkge1xuICAgICAgICAvLyBHZXQgdGhlIHNhdmUgcGVyaW9kIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNsaWRlciB2YWx1ZS5cbiAgICAgICAgY29uc3QgbWF4UmVxID0gZmFpbDJCYW5JbmRleC5tYXhSZXFWYWx1ZVt2YWx1ZV07XG4gICAgICAgIC8vIFNldCB0aGUgZm9ybSB2YWx1ZSBmb3IgJ1BCWFJlY29yZFNhdmVQZXJpb2QnIHRvIHRoZSBzZWxlY3RlZCBzYXZlIHBlcmlvZC5cbiAgICAgICAgZmFpbDJCYW5JbmRleC4kZm9ybU9iai5mb3JtKCdzZXQgdmFsdWUnLCAnUEJYRmlyZXdhbGxNYXhSZXFTZWMnLCBtYXhSZXEpO1xuICAgICAgICAvLyBUcmlnZ2VyIGNoYW5nZSBldmVudCB0byBhY2tub3dsZWRnZSB0aGUgbW9kaWZpY2F0aW9uXG4gICAgICAgIEZvcm0uZGF0YUNoYW5nZWQoKTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGRhdGEgdGFibGUgb24gdGhlIHBhZ2VcbiAgICAgKlxuICAgICAqL1xuICAgIGluaXRpYWxpemVEYXRhVGFibGUoKXtcbiAgICAgICAgJCgnI2ZhaWwyYmFuLXRhYi1tZW51IC5pdGVtJykudGFiKHtcbiAgICAgICAgICAgIG9uVmlzaWJsZSgpe1xuICAgICAgICAgICAgICAgIGlmICgkKHRoaXMpLmRhdGEoJ3RhYicpPT09J2Jhbm5lZCcgJiYgZmFpbDJCYW5JbmRleC5kYXRhVGFibGUhPT1udWxsKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGFnZUxlbmd0aCA9IGZhaWwyQmFuSW5kZXguY2FsY3VsYXRlUGFnZUxlbmd0aCgpO1xuICAgICAgICAgICAgICAgICAgICBmYWlsMkJhbkluZGV4LmRhdGFUYWJsZS5wYWdlLmxlbihuZXdQYWdlTGVuZ3RoKS5kcmF3KGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZhaWwyQmFuSW5kZXguZGF0YVRhYmxlID0gZmFpbDJCYW5JbmRleC4kYmFubmVkSXBMaXN0VGFibGUuRGF0YVRhYmxlKHtcbiAgICAgICAgICAgIC8vIGRlc3Ryb3k6IHRydWUsXG4gICAgICAgICAgICBsZW5ndGhDaGFuZ2U6IGZhbHNlLFxuICAgICAgICAgICAgcGFnaW5nOiB0cnVlLFxuICAgICAgICAgICAgcGFnZUxlbmd0aDogZmFpbDJCYW5JbmRleC5jYWxjdWxhdGVQYWdlTGVuZ3RoKCksXG4gICAgICAgICAgICBzY3JvbGxDb2xsYXBzZTogdHJ1ZSxcbiAgICAgICAgICAgIGRlZmVyUmVuZGVyOiB0cnVlLFxuICAgICAgICAgICAgY29sdW1uczogW1xuICAgICAgICAgICAgICAgIC8vIElQXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBvcmRlcmFibGU6IHRydWUsICAvLyBUaGlzIGNvbHVtbiBpcyBvcmRlcmFibGVcbiAgICAgICAgICAgICAgICAgICAgc2VhcmNoYWJsZTogdHJ1ZSAgLy8gVGhpcyBjb2x1bW4gaXMgc2VhcmNoYWJsZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgLy8gUmVhc29uXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBvcmRlcmFibGU6IGZhbHNlLCAgLy8gVGhpcyBjb2x1bW4gaXMgbm90IG9yZGVyYWJsZVxuICAgICAgICAgICAgICAgICAgICBzZWFyY2hhYmxlOiBmYWxzZSAgLy8gVGhpcyBjb2x1bW4gaXMgbm90IHNlYXJjaGFibGVcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIC8vIEJ1dHRvbnNcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG9yZGVyYWJsZTogZmFsc2UsICAvLyBUaGlzIGNvbHVtbiBpcyBvcmRlcmFibGVcbiAgICAgICAgICAgICAgICAgICAgc2VhcmNoYWJsZTogZmFsc2UgIC8vIFRoaXMgY29sdW1uIGlzIHNlYXJjaGFibGVcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIG9yZGVyOiBbMCwgJ2FzYyddLFxuICAgICAgICAgICAgbGFuZ3VhZ2U6IFNlbWFudGljTG9jYWxpemF0aW9uLmRhdGFUYWJsZUxvY2FsaXNhdGlvbixcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQ29uc3RydWN0cyB0aGUgRXh0ZW5zaW9ucyByb3cuXG4gICAgICAgICAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3cgLSBUaGUgcm93IGVsZW1lbnQuXG4gICAgICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBkYXRhIC0gVGhlIHJvdyBkYXRhLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBjcmVhdGVkUm93KHJvdywgZGF0YSkge1xuICAgICAgICAgICAgICAgICQoJ3RkJywgcm93KS5lcSgwKS5hZGRDbGFzcygnY29sbGFwc2luZycpO1xuICAgICAgICAgICAgICAgICQoJ3RkJywgcm93KS5lcSgyKS5hZGRDbGFzcygnY29sbGFwc2luZycpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8vIFRoaXMgY2FsbGJhY2sgbWV0aG9kIGlzIHVzZWQgdG8gZGlzcGxheSB0aGUgbGlzdCBvZiBiYW5uZWQgSVBzLlxuICAgIGNiR2V0QmFubmVkSXBMaXN0KHJlc3BvbnNlKSB7XG4gICAgICAgIGZhaWwyQmFuSW5kZXguJGJhbm5lZElwTGlzdFRhYmxlLnJlbW92ZUNsYXNzKCdsb2FkaW5nJyk7XG4gICAgICAgIGlmIChyZXNwb25zZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhciB0aGUgRGF0YVRhYmxlXG4gICAgICAgIGZhaWwyQmFuSW5kZXguZGF0YVRhYmxlLmNsZWFyKCk7XG5cbiAgICAgICAgLy8gUHJlcGFyZSB0aGUgbmV3IGRhdGEgdG8gYmUgYWRkZWRcbiAgICAgICAgbGV0IG5ld0RhdGEgPSBbXTtcbiAgICAgICAgT2JqZWN0LmtleXMocmVzcG9uc2UpLmZvckVhY2goaXAgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmFucyA9IHJlc3BvbnNlW2lwXTtcbiAgICAgICAgICAgIC8vIENvbWJpbmUgYWxsIHJlYXNvbnMgYW5kIGRhdGVzIGZvciB0aGlzIElQIGludG8gb25lIHN0cmluZ1xuICAgICAgICAgICAgbGV0IHJlYXNvbnNEYXRlc0NvbWJpbmVkID0gYmFucy5tYXAoYmFuID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBibG9ja0RhdGUgPSBuZXcgRGF0ZShiYW4udGltZW9mYmFuICogMTAwMCkudG9Mb2NhbGVTdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBsZXQgcmVhc29uID0gYGYyYl9KYWlsXyR7YmFuLmphaWx9YDtcbiAgICAgICAgICAgICAgICBpZiAocmVhc29uIGluIGdsb2JhbFRyYW5zbGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICByZWFzb24gPSBnbG9iYWxUcmFuc2xhdGVbcmVhc29uXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke3JlYXNvbn0gLSAke2Jsb2NrRGF0ZX1gO1xuICAgICAgICAgICAgfSkuam9pbignPGJyPicpOyAvLyBVc2UgbGluZSBicmVha3MgdG8gc2VwYXJhdGUgZWFjaCByZWFzb24tZGF0ZSBwYWlyXG5cbiAgICAgICAgICAgIC8vIENvbnN0cnVjdCBhIHJvdzogSVAsIENvbWJpbmVkIFJlYXNvbnMgYW5kIERhdGVzLCBVbmJhbiBCdXR0b25cbiAgICAgICAgICAgIGNvbnN0IHJvdyA9IFtcbiAgICAgICAgICAgICAgICBpcCxcbiAgICAgICAgICAgICAgICByZWFzb25zRGF0ZXNDb21iaW5lZCxcbiAgICAgICAgICAgICAgICBgPGJ1dHRvbiBjbGFzcz1cInVpIGljb24gYmFzaWMgbWluaSBidXR0b24gcmlnaHQgZmxvYXRlZCB1bmJhbi1idXR0b25cIiBkYXRhLXZhbHVlPVwiJHtpcH1cIj48aSBjbGFzcz1cImljb24gdHJhc2ggcmVkXCI+PC9pPiR7Z2xvYmFsVHJhbnNsYXRlLmYyYl9VbmJhbn08L2J1dHRvbj5gXG4gICAgICAgICAgICBdO1xuICAgICAgICAgICAgbmV3RGF0YS5wdXNoKHJvdyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCB0aGUgbmV3IGRhdGEgYW5kIHJlZHJhdyB0aGUgdGFibGVcbiAgICAgICAgZmFpbDJCYW5JbmRleC5kYXRhVGFibGUucm93cy5hZGQobmV3RGF0YSkuZHJhdygpO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIGNhbGxiYWNrIG1ldGhvZCBpcyB1c2VkIGFmdGVyIGFuIElQIGhhcyBiZWVuIHVuYmFubmVkLlxuICAgIGNiQWZ0ZXJVbkJhbklwKCkge1xuICAgICAgICBQYnhBcGkuRmlyZXdhbGxHZXRCYW5uZWRJcChmYWlsMkJhbkluZGV4LmNiR2V0QmFubmVkSXBMaXN0KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsbGJhY2sgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGJlZm9yZSB0aGUgZm9ybSBpcyBzZW50XG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIC0gVGhlIGN1cnJlbnQgc2V0dGluZ3Mgb2YgdGhlIGZvcm1cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAtIFRoZSB1cGRhdGVkIHNldHRpbmdzIG9mIHRoZSBmb3JtXG4gICAgICovXG4gICAgY2JCZWZvcmVTZW5kRm9ybShzZXR0aW5ncykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBzZXR0aW5ncztcbiAgICAgICAgcmVzdWx0LmRhdGEgPSBmYWlsMkJhbkluZGV4LiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsbGJhY2sgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBmb3JtIGhhcyBiZWVuIHNlbnQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIC0gVGhlIHJlc3BvbnNlIGZyb20gdGhlIHNlcnZlciBhZnRlciB0aGUgZm9ybSBpcyBzZW50XG4gICAgICovXG4gICAgY2JBZnRlclNlbmRGb3JtKHJlc3BvbnNlKSB7XG5cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlIGRhdGEgdGFibGUgcGFnZSBsZW5ndGhcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICovXG4gICAgY2FsY3VsYXRlUGFnZUxlbmd0aCgpIHtcbiAgICAgICAgLy8gQ2FsY3VsYXRlIHJvdyBoZWlnaHRcbiAgICAgICAgbGV0IHJvd0hlaWdodCA9IGZhaWwyQmFuSW5kZXguJGJhbm5lZElwTGlzdFRhYmxlLmZpbmQoJ3RyJykubGFzdCgpLm91dGVySGVpZ2h0KCk7XG4gICAgICAgIC8vIENhbGN1bGF0ZSB3aW5kb3cgaGVpZ2h0IGFuZCBhdmFpbGFibGUgc3BhY2UgZm9yIHRhYmxlXG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICAgICAgY29uc3QgaGVhZGVyRm9vdGVySGVpZ2h0ID0gNDAwOyAvLyBFc3RpbWF0ZSBoZWlnaHQgZm9yIGhlYWRlciwgZm9vdGVyLCBhbmQgb3RoZXIgZWxlbWVudHNcblxuICAgICAgICAvLyBDYWxjdWxhdGUgbmV3IHBhZ2UgbGVuZ3RoXG4gICAgICAgIHJldHVybiBNYXRoLm1heChNYXRoLmZsb29yKCh3aW5kb3dIZWlnaHQgLSBoZWFkZXJGb290ZXJIZWlnaHQpIC8gcm93SGVpZ2h0KSwgMTApO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBmb3JtIHdpdGggY3VzdG9tIHNldHRpbmdzXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUZvcm0oKSB7XG4gICAgICAgIEZvcm0uJGZvcm1PYmogPSBmYWlsMkJhbkluZGV4LiRmb3JtT2JqO1xuICAgICAgICBGb3JtLnVybCA9IGAke2dsb2JhbFJvb3RVcmx9ZmFpbDItYmFuL3NhdmVgOyAvLyBGb3JtIHN1Ym1pc3Npb24gVVJMXG4gICAgICAgIEZvcm0udmFsaWRhdGVSdWxlcyA9IGZhaWwyQmFuSW5kZXgudmFsaWRhdGVSdWxlczsgLy8gRm9ybSB2YWxpZGF0aW9uIHJ1bGVzXG4gICAgICAgIEZvcm0uY2JCZWZvcmVTZW5kRm9ybSA9IGZhaWwyQmFuSW5kZXguY2JCZWZvcmVTZW5kRm9ybTsgLy8gQ2FsbGJhY2sgYmVmb3JlIGZvcm0gaXMgc2VudFxuICAgICAgICBGb3JtLmNiQWZ0ZXJTZW5kRm9ybSA9IGZhaWwyQmFuSW5kZXguY2JBZnRlclNlbmRGb3JtOyAvLyBDYWxsYmFjayBhZnRlciBmb3JtIGlzIHNlbnRcbiAgICAgICAgRm9ybS5pbml0aWFsaXplKCk7XG4gICAgfSxcbn07XG5cbi8vIFdoZW4gdGhlIGRvY3VtZW50IGlzIHJlYWR5LCBpbml0aWFsaXplIHRoZSBGYWlsMkJhbiBtYW5hZ2VtZW50IGludGVyZmFjZS5cbiQoZG9jdW1lbnQpLnJlYWR5KCgpID0+IHtcbiAgICBmYWlsMkJhbkluZGV4LmluaXRpYWxpemUoKTtcbn0pO1xuXG4iXX0=