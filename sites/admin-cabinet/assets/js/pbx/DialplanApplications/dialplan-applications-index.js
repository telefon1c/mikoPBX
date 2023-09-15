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

/* global globalRootUrl, SemanticLocalization, UserMessage, DialplanApplicationsAPI */

/**
 * The dialplanApplicationsIndex object.
 * Manages the operations and behaviors of the Dialplan applications table in the UI.
 *
 * @module dialplanApplicationsIndex
 */
var dialplanApplicationsIndex = {
  $dialplanApplicationsTable: $('#dialplan-applications-table'),

  /**
   * Initializes the Dialplan Applications Table.
   * Sets up the data table, moves the "Add New" button, and adds a double click event handler to table rows.
   */
  initialize: function initialize() {
    $('#custom-applications-table').DataTable({
      lengthChange: false,
      paging: false,
      columns: [null, null, {
        orderable: false,
        searchable: false
      }, {
        orderable: false,
        searchable: false
      }],
      order: [0, 'asc'],
      language: SemanticLocalization.dataTableLocalisation
    }); // Move the "Add New" button to the first eight-column div

    $('#add-new-button').appendTo($('div.eight.column:eq(0)')); // Attach double click event handler to table rows

    $('.app-row td').on('dblclick', function (e) {
      // On double click, navigate to the modification page of the clicked application
      var id = $(e.target).closest('tr').attr('id');
      window.location = "".concat(globalRootUrl, "dialplan-applications/modify/").concat(id);
    }); // Set up delete functionality on delete button click.

    $('body').on('click', 'a.delete', function (e) {
      e.preventDefault();
      $(e.target).addClass('disabled'); // Get the dialplan application  ID from the closest table row.

      var rowId = $(e.target).closest('tr').attr('id'); // Remove any previous AJAX messages.

      $('.message.ajax').remove(); // Call the PbxApi method to delete the dialplan application record.

      DialplanApplicationsAPI.deleteRecord(rowId, dialplanApplicationsIndex.cbAfterDeleteRecord);
    });
  },

  /**
   * Callback function executed after deleting a record.
   * @param {Object} response - The response object from the API.
   */
  cbAfterDeleteRecord: function cbAfterDeleteRecord(response) {
    if (response.result === true) {
      // Remove the deleted record's table row.
      dialplanApplicationsIndex.$dialplanApplicationsTable.find("tr[id=".concat(response.data.id, "]")).remove(); // Call the callback function for data change.

      Extensions.cbOnDataChanged();
    } else {
      // Show an error message if deletion was not successful.
      UserMessage.showError(response.messages.error, globalTranslate.da_ImpossibleToDeleteDialplanApplication);
    }

    $('a.delete').removeClass('disabled');
  }
}; // Initialize the Dialplan Applications table when the document is ready

$(document).ready(function () {
  dialplanApplicationsIndex.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9EaWFscGxhbkFwcGxpY2F0aW9ucy9kaWFscGxhbi1hcHBsaWNhdGlvbnMtaW5kZXguanMiXSwibmFtZXMiOlsiZGlhbHBsYW5BcHBsaWNhdGlvbnNJbmRleCIsIiRkaWFscGxhbkFwcGxpY2F0aW9uc1RhYmxlIiwiJCIsImluaXRpYWxpemUiLCJEYXRhVGFibGUiLCJsZW5ndGhDaGFuZ2UiLCJwYWdpbmciLCJjb2x1bW5zIiwib3JkZXJhYmxlIiwic2VhcmNoYWJsZSIsIm9yZGVyIiwibGFuZ3VhZ2UiLCJTZW1hbnRpY0xvY2FsaXphdGlvbiIsImRhdGFUYWJsZUxvY2FsaXNhdGlvbiIsImFwcGVuZFRvIiwib24iLCJlIiwiaWQiLCJ0YXJnZXQiLCJjbG9zZXN0IiwiYXR0ciIsIndpbmRvdyIsImxvY2F0aW9uIiwiZ2xvYmFsUm9vdFVybCIsInByZXZlbnREZWZhdWx0IiwiYWRkQ2xhc3MiLCJyb3dJZCIsInJlbW92ZSIsIkRpYWxwbGFuQXBwbGljYXRpb25zQVBJIiwiZGVsZXRlUmVjb3JkIiwiY2JBZnRlckRlbGV0ZVJlY29yZCIsInJlc3BvbnNlIiwicmVzdWx0IiwiZmluZCIsImRhdGEiLCJFeHRlbnNpb25zIiwiY2JPbkRhdGFDaGFuZ2VkIiwiVXNlck1lc3NhZ2UiLCJzaG93RXJyb3IiLCJtZXNzYWdlcyIsImVycm9yIiwiZ2xvYmFsVHJhbnNsYXRlIiwiZGFfSW1wb3NzaWJsZVRvRGVsZXRlRGlhbHBsYW5BcHBsaWNhdGlvbiIsInJlbW92ZUNsYXNzIiwiZG9jdW1lbnQiLCJyZWFkeSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQU1BLHlCQUF5QixHQUFHO0FBRTlCQyxFQUFBQSwwQkFBMEIsRUFBRUMsQ0FBQyxD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QyxFQUFBQSx5QkFBeUIsQ0FBQ0csVUFBMUI7QUFDSCxDQUZEIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIE1pa29QQlggLSBmcmVlIHBob25lIHN5c3RlbSBmb3Igc21hbGwgYnVzaW5lc3NcbiAqIENvcHlyaWdodCDCqSAyMDE3LTIwMjMgQWxleGV5IFBvcnRub3YgYW5kIE5pa29sYXkgQmVrZXRvdlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG4gKiBpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuICogdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbjsgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3JcbiAqIChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG4gKiBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuICogTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuICogR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwczovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cblxuLyogZ2xvYmFsIGdsb2JhbFJvb3RVcmwsIFNlbWFudGljTG9jYWxpemF0aW9uLCBVc2VyTWVzc2FnZSwgRGlhbHBsYW5BcHBsaWNhdGlvbnNBUEkgKi9cblxuLyoqXG4gKiBUaGUgZGlhbHBsYW5BcHBsaWNhdGlvbnNJbmRleCBvYmplY3QuXG4gKiBNYW5hZ2VzIHRoZSBvcGVyYXRpb25zIGFuZCBiZWhhdmlvcnMgb2YgdGhlIERpYWxwbGFuIGFwcGxpY2F0aW9ucyB0YWJsZSBpbiB0aGUgVUkuXG4gKlxuICogQG1vZHVsZSBkaWFscGxhbkFwcGxpY2F0aW9uc0luZGV4XG4gKi9cbmNvbnN0IGRpYWxwbGFuQXBwbGljYXRpb25zSW5kZXggPSB7XG5cbiAgICAkZGlhbHBsYW5BcHBsaWNhdGlvbnNUYWJsZTogJCgnI2RpYWxwbGFuLWFwcGxpY2F0aW9ucy10YWJsZScpLFxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIERpYWxwbGFuIEFwcGxpY2F0aW9ucyBUYWJsZS5cbiAgICAgKiBTZXRzIHVwIHRoZSBkYXRhIHRhYmxlLCBtb3ZlcyB0aGUgXCJBZGQgTmV3XCIgYnV0dG9uLCBhbmQgYWRkcyBhIGRvdWJsZSBjbGljayBldmVudCBoYW5kbGVyIHRvIHRhYmxlIHJvd3MuXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgJCgnI2N1c3RvbS1hcHBsaWNhdGlvbnMtdGFibGUnKS5EYXRhVGFibGUoe1xuICAgICAgICAgICAgbGVuZ3RoQ2hhbmdlOiBmYWxzZSxcbiAgICAgICAgICAgIHBhZ2luZzogZmFsc2UsXG4gICAgICAgICAgICBjb2x1bW5zOiBbXG4gICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgIHtvcmRlcmFibGU6IGZhbHNlLCBzZWFyY2hhYmxlOiBmYWxzZX0sXG4gICAgICAgICAgICAgICAge29yZGVyYWJsZTogZmFsc2UsIHNlYXJjaGFibGU6IGZhbHNlfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBvcmRlcjogWzAsICdhc2MnXSxcbiAgICAgICAgICAgIGxhbmd1YWdlOiBTZW1hbnRpY0xvY2FsaXphdGlvbi5kYXRhVGFibGVMb2NhbGlzYXRpb24sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE1vdmUgdGhlIFwiQWRkIE5ld1wiIGJ1dHRvbiB0byB0aGUgZmlyc3QgZWlnaHQtY29sdW1uIGRpdlxuICAgICAgICAkKCcjYWRkLW5ldy1idXR0b24nKS5hcHBlbmRUbygkKCdkaXYuZWlnaHQuY29sdW1uOmVxKDApJykpO1xuXG4gICAgICAgIC8vIEF0dGFjaCBkb3VibGUgY2xpY2sgZXZlbnQgaGFuZGxlciB0byB0YWJsZSByb3dzXG4gICAgICAgICQoJy5hcHAtcm93IHRkJykub24oJ2RibGNsaWNrJywgKGUpID0+IHtcbiAgICAgICAgICAgIC8vIE9uIGRvdWJsZSBjbGljaywgbmF2aWdhdGUgdG8gdGhlIG1vZGlmaWNhdGlvbiBwYWdlIG9mIHRoZSBjbGlja2VkIGFwcGxpY2F0aW9uXG4gICAgICAgICAgICBjb25zdCBpZCA9ICQoZS50YXJnZXQpLmNsb3Nlc3QoJ3RyJykuYXR0cignaWQnKTtcbiAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbiA9IGAke2dsb2JhbFJvb3RVcmx9ZGlhbHBsYW4tYXBwbGljYXRpb25zL21vZGlmeS8ke2lkfWA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFNldCB1cCBkZWxldGUgZnVuY3Rpb25hbGl0eSBvbiBkZWxldGUgYnV0dG9uIGNsaWNrLlxuICAgICAgICAkKCdib2R5Jykub24oJ2NsaWNrJywgJ2EuZGVsZXRlJywgKGUpID0+IHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICQoZS50YXJnZXQpLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBkaWFscGxhbiBhcHBsaWNhdGlvbiAgSUQgZnJvbSB0aGUgY2xvc2VzdCB0YWJsZSByb3cuXG4gICAgICAgICAgICBjb25zdCByb3dJZCA9ICQoZS50YXJnZXQpLmNsb3Nlc3QoJ3RyJykuYXR0cignaWQnKTtcblxuICAgICAgICAgICAgLy8gUmVtb3ZlIGFueSBwcmV2aW91cyBBSkFYIG1lc3NhZ2VzLlxuICAgICAgICAgICAgJCgnLm1lc3NhZ2UuYWpheCcpLnJlbW92ZSgpO1xuXG4gICAgICAgICAgICAvLyBDYWxsIHRoZSBQYnhBcGkgbWV0aG9kIHRvIGRlbGV0ZSB0aGUgZGlhbHBsYW4gYXBwbGljYXRpb24gcmVjb3JkLlxuICAgICAgICAgICAgRGlhbHBsYW5BcHBsaWNhdGlvbnNBUEkuZGVsZXRlUmVjb3JkKHJvd0lkLCBkaWFscGxhbkFwcGxpY2F0aW9uc0luZGV4LmNiQWZ0ZXJEZWxldGVSZWNvcmQpO1xuICAgICAgICB9KTtcblxuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ2FsbGJhY2sgZnVuY3Rpb24gZXhlY3V0ZWQgYWZ0ZXIgZGVsZXRpbmcgYSByZWNvcmQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIC0gVGhlIHJlc3BvbnNlIG9iamVjdCBmcm9tIHRoZSBBUEkuXG4gICAgICovXG4gICAgY2JBZnRlckRlbGV0ZVJlY29yZChyZXNwb25zZSl7XG4gICAgICAgIGlmIChyZXNwb25zZS5yZXN1bHQgPT09IHRydWUpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgZGVsZXRlZCByZWNvcmQncyB0YWJsZSByb3cuXG4gICAgICAgICAgICBkaWFscGxhbkFwcGxpY2F0aW9uc0luZGV4LiRkaWFscGxhbkFwcGxpY2F0aW9uc1RhYmxlLmZpbmQoYHRyW2lkPSR7cmVzcG9uc2UuZGF0YS5pZH1dYCkucmVtb3ZlKCk7XG4gICAgICAgICAgICAvLyBDYWxsIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBmb3IgZGF0YSBjaGFuZ2UuXG4gICAgICAgICAgICBFeHRlbnNpb25zLmNiT25EYXRhQ2hhbmdlZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU2hvdyBhbiBlcnJvciBtZXNzYWdlIGlmIGRlbGV0aW9uIHdhcyBub3Qgc3VjY2Vzc2Z1bC5cbiAgICAgICAgICAgIFVzZXJNZXNzYWdlLnNob3dFcnJvcihyZXNwb25zZS5tZXNzYWdlcy5lcnJvciwgZ2xvYmFsVHJhbnNsYXRlLmRhX0ltcG9zc2libGVUb0RlbGV0ZURpYWxwbGFuQXBwbGljYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgICQoJ2EuZGVsZXRlJykucmVtb3ZlQ2xhc3MoJ2Rpc2FibGVkJyk7XG4gICAgfSxcblxufTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgRGlhbHBsYW4gQXBwbGljYXRpb25zIHRhYmxlIHdoZW4gdGhlIGRvY3VtZW50IGlzIHJlYWR5XG4kKGRvY3VtZW50KS5yZWFkeSgoKSA9PiB7XG4gICAgZGlhbHBsYW5BcHBsaWNhdGlvbnNJbmRleC5pbml0aWFsaXplKCk7XG59KTtcblxuIl19