"use strict";

/*
 * Copyright © MIKO LLC - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Alexey Portnov, 8 2020
 */

/* global ace, PbxApi */
var updateLogViewWorker = {
  timeOut: 3000,
  timeOutHandle: '',
  errorCounts: 0,
  initialize: function () {
    function initialize() {
      updateLogViewWorker.restartWorker();
    }

    return initialize;
  }(),
  restartWorker: function () {
    function restartWorker() {
      window.clearTimeout(updateLogViewWorker.timeoutHandle);
      updateLogViewWorker.worker();
    }

    return restartWorker;
  }(),
  worker: function () {
    function worker() {
      var data = systemDiagnosticLogs.$formObj.form('get values');
      PbxApi.SyslogGetLogFromFile(data.filename, data.filter, data.lines, systemDiagnosticLogs.cbUpdateLogText);
      updateLogViewWorker.timeoutHandle = window.setTimeout(updateLogViewWorker.worker, updateLogViewWorker.timeOut);
    }

    return worker;
  }(),
  stop: function () {
    function stop() {
      window.clearTimeout(updateLogViewWorker.timeoutHandle);
    }

    return stop;
  }()
};
var systemDiagnosticLogs = {
  $showBtn: $('#show-last-log'),
  $downloadBtn: $('#download-file'),
  $showAutoBtn: $('#show-last-log-auto'),
  viewer: '',
  $fileSelectDropDown: $('#system-diagnostic-form .filenames-select'),
  logsItems: [],
  defaultLogItem: null,
  $formObj: $('#system-diagnostic-form'),
  $fileName: $('#system-diagnostic-form .filename'),
  initialize: function () {
    function initialize() {
      systemDiagnosticLogs.initializeAce();
      PbxApi.SyslogGetLogsList(systemDiagnosticLogs.cbFormatDropdownResults);
      systemDiagnosticLogs.$showBtn.on('click', function (e) {
        e.preventDefault();
        var data = systemDiagnosticLogs.$formObj.form('get values');
        PbxApi.SyslogGetLogFromFile(data.filename, data.filter, data.lines, systemDiagnosticLogs.cbUpdateLogText);
      });
      systemDiagnosticLogs.$downloadBtn.on('click', function (e) {
        e.preventDefault();
        var data = systemDiagnosticLogs.$formObj.form('get values');
        PbxApi.SyslogDownloadLogFile(data.filename, systemDiagnosticLogs.cbDownloadFile);
      });
      systemDiagnosticLogs.$showAutoBtn.on('click', function (e) {
        e.preventDefault();
        var $reloadIcon = systemDiagnosticLogs.$showAutoBtn.find('i.refresh');

        if ($reloadIcon.hasClass('loading')) {
          $reloadIcon.removeClass('loading');
          updateLogViewWorker.stop();
        } else {
          $reloadIcon.addClass('loading');
          updateLogViewWorker.initialize();
        }
      });
    }

    return initialize;
  }(),
  initializeAce: function () {
    function initializeAce() {
      var IniMode = ace.require('ace/mode/julia').Mode;

      systemDiagnosticLogs.viewer = ace.edit('log-content-readonly');
      systemDiagnosticLogs.viewer.setReadOnly(true);
      systemDiagnosticLogs.viewer.session.setMode(new IniMode());
      systemDiagnosticLogs.viewer.setTheme('ace/theme/monokai');
      systemDiagnosticLogs.viewer.resize();
      systemDiagnosticLogs.viewer.setShowPrintMargin(false);
      systemDiagnosticLogs.viewer.setOptions({
        maxLines: 45
      });
    }

    return initializeAce;
  }(),

  /**
   * Makes formatted menu structure
   */
  cbFormatDropdownResults: function () {
    function cbFormatDropdownResults(response) {
      if (response === false) {
        return;
      }

      systemDiagnosticLogs.logsItems = [];
      var files = response.files;
      $.each(files, function (index, item) {
        systemDiagnosticLogs.logsItems.push({
          name: "".concat(index, " (").concat(item.size, ")"),
          value: item.path,
          selected: item["default"]
        });
      });
      systemDiagnosticLogs.$fileSelectDropDown.dropdown({
        values: systemDiagnosticLogs.logsItems,
        onChange: systemDiagnosticLogs.cbOnChangeFile,
        ignoreCase: true,
        fullTextSearch: true,
        forceSelection: false
      });
    }

    return cbFormatDropdownResults;
  }(),

  /**
   * Callback after change log file in select
   * @param value
   */
  cbOnChangeFile: function () {
    function cbOnChangeFile(value) {
      if (value.length === 0) {
        return;
      }

      systemDiagnosticLogs.$formObj.form('set value', 'filename', value);
      var data = systemDiagnosticLogs.$formObj.form('get values');
      PbxApi.SyslogGetLogFromFile(data.filename, data.filter, data.lines, systemDiagnosticLogs.cbUpdateLogText);
    }

    return cbOnChangeFile;
  }(),

  /**
   * Updates log view
   * @param data
   */
  cbUpdateLogText: function () {
    function cbUpdateLogText(data) {
      systemDiagnosticLogs.viewer.getSession().setValue(data.content);
      var row = systemDiagnosticLogs.viewer.session.getLength() - 1;
      var column = systemDiagnosticLogs.viewer.session.getLine(row).length; // or simply Infinity

      systemDiagnosticLogs.viewer.gotoLine(row + 1, column);
    }

    return cbUpdateLogText;
  }(),

  /**
   * After push button download file
   * @param response
   */
  cbDownloadFile: function () {
    function cbDownloadFile(response) {
      if (response !== false) {
        window.location = response.filename;
      }
    }

    return cbDownloadFile;
  }()
};
$(document).ready(function () {
  systemDiagnosticLogs.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9TeXN0ZW1EaWFnbm9zdGljL3N5c3RlbS1kaWFnbm9zdGljLWluZGV4LXNob3dsb2dzLmpzIl0sIm5hbWVzIjpbInVwZGF0ZUxvZ1ZpZXdXb3JrZXIiLCJ0aW1lT3V0IiwidGltZU91dEhhbmRsZSIsImVycm9yQ291bnRzIiwiaW5pdGlhbGl6ZSIsInJlc3RhcnRXb3JrZXIiLCJ3aW5kb3ciLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0SGFuZGxlIiwid29ya2VyIiwiZGF0YSIsInN5c3RlbURpYWdub3N0aWNMb2dzIiwiJGZvcm1PYmoiLCJmb3JtIiwiUGJ4QXBpIiwiU3lzbG9nR2V0TG9nRnJvbUZpbGUiLCJmaWxlbmFtZSIsImZpbHRlciIsImxpbmVzIiwiY2JVcGRhdGVMb2dUZXh0Iiwic2V0VGltZW91dCIsInN0b3AiLCIkc2hvd0J0biIsIiQiLCIkZG93bmxvYWRCdG4iLCIkc2hvd0F1dG9CdG4iLCJ2aWV3ZXIiLCIkZmlsZVNlbGVjdERyb3BEb3duIiwibG9nc0l0ZW1zIiwiZGVmYXVsdExvZ0l0ZW0iLCIkZmlsZU5hbWUiLCJpbml0aWFsaXplQWNlIiwiU3lzbG9nR2V0TG9nc0xpc3QiLCJjYkZvcm1hdERyb3Bkb3duUmVzdWx0cyIsIm9uIiwiZSIsInByZXZlbnREZWZhdWx0IiwiU3lzbG9nRG93bmxvYWRMb2dGaWxlIiwiY2JEb3dubG9hZEZpbGUiLCIkcmVsb2FkSWNvbiIsImZpbmQiLCJoYXNDbGFzcyIsInJlbW92ZUNsYXNzIiwiYWRkQ2xhc3MiLCJJbmlNb2RlIiwiYWNlIiwicmVxdWlyZSIsIk1vZGUiLCJlZGl0Iiwic2V0UmVhZE9ubHkiLCJzZXNzaW9uIiwic2V0TW9kZSIsInNldFRoZW1lIiwicmVzaXplIiwic2V0U2hvd1ByaW50TWFyZ2luIiwic2V0T3B0aW9ucyIsIm1heExpbmVzIiwicmVzcG9uc2UiLCJmaWxlcyIsImVhY2giLCJpbmRleCIsIml0ZW0iLCJwdXNoIiwibmFtZSIsInNpemUiLCJ2YWx1ZSIsInBhdGgiLCJzZWxlY3RlZCIsImRyb3Bkb3duIiwidmFsdWVzIiwib25DaGFuZ2UiLCJjYk9uQ2hhbmdlRmlsZSIsImlnbm9yZUNhc2UiLCJmdWxsVGV4dFNlYXJjaCIsImZvcmNlU2VsZWN0aW9uIiwibGVuZ3RoIiwiZ2V0U2Vzc2lvbiIsInNldFZhbHVlIiwiY29udGVudCIsInJvdyIsImdldExlbmd0aCIsImNvbHVtbiIsImdldExpbmUiLCJnb3RvTGluZSIsImxvY2F0aW9uIiwiZG9jdW1lbnQiLCJyZWFkeSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7OztBQU1BO0FBR0EsSUFBTUEsbUJBQW1CLEdBQUc7QUFDM0JDLEVBQUFBLE9BQU8sRUFBRSxJQURrQjtBQUUzQkMsRUFBQUEsYUFBYSxFQUFFLEVBRlk7QUFHM0JDLEVBQUFBLFdBQVcsRUFBRSxDQUhjO0FBSTNCQyxFQUFBQSxVQUoyQjtBQUFBLDBCQUlkO0FBQ1pKLE1BQUFBLG1CQUFtQixDQUFDSyxhQUFwQjtBQUNBOztBQU4wQjtBQUFBO0FBTzNCQSxFQUFBQSxhQVAyQjtBQUFBLDZCQU9YO0FBQ2ZDLE1BQUFBLE1BQU0sQ0FBQ0MsWUFBUCxDQUFvQlAsbUJBQW1CLENBQUNRLGFBQXhDO0FBQ0FSLE1BQUFBLG1CQUFtQixDQUFDUyxNQUFwQjtBQUNBOztBQVYwQjtBQUFBO0FBVzNCQSxFQUFBQSxNQVgyQjtBQUFBLHNCQVdsQjtBQUNSLFVBQU1DLElBQUksR0FBR0Msb0JBQW9CLENBQUNDLFFBQXJCLENBQThCQyxJQUE5QixDQUFtQyxZQUFuQyxDQUFiO0FBQ0FDLE1BQUFBLE1BQU0sQ0FBQ0Msb0JBQVAsQ0FBNEJMLElBQUksQ0FBQ00sUUFBakMsRUFBMkNOLElBQUksQ0FBQ08sTUFBaEQsRUFBd0RQLElBQUksQ0FBQ1EsS0FBN0QsRUFBb0VQLG9CQUFvQixDQUFDUSxlQUF6RjtBQUNBbkIsTUFBQUEsbUJBQW1CLENBQUNRLGFBQXBCLEdBQW9DRixNQUFNLENBQUNjLFVBQVAsQ0FDbkNwQixtQkFBbUIsQ0FBQ1MsTUFEZSxFQUVuQ1QsbUJB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RCxDQUE5RDtBQUNBLFVBQU1DLE1BQU0sR0FBR3RFLG9CQUFvQixDQUFDZSxNQUFyQixDQUE0QndCLE9BQTVCLENBQW9DZ0MsT0FBcEMsQ0FBNENILEdBQTVDLEVBQWlESixNQUFoRSxDQUhxQixDQUdtRDs7QUFDeEVoRSxNQUFBQSxvQkFBb0IsQ0FBQ2UsTUFBckIsQ0FBNEJ5RCxRQUE1QixDQUFxQ0osR0FBRyxHQUFHLENBQTNDLEVBQThDRSxNQUE5QztBQUNBOztBQWpHMkI7QUFBQTs7QUFrRzVCOzs7O0FBSUEzQyxFQUFBQSxjQXRHNEI7QUFBQSw0QkFzR2JtQixRQXRHYSxFQXNHSjtBQUN2QixVQUFJQSxRQUFRLEtBQUcsS0FBZixFQUFxQjtBQUNwQm5ELFFBQUFBLE1BQU0sQ0FBQzhFLFFBQVAsR0FBa0IzQixRQUFRLENBQUN6QyxRQUEzQjtBQUNBO0FBQ0Q7O0FBMUcyQjtBQUFBO0FBQUEsQ0FBN0I7QUE2R0FPLENBQUMsQ0FBQzhELFFBQUQsQ0FBRCxDQUFZQyxLQUFaLENBQWtCLFlBQU07QUFDdkIzRSxFQUFBQSxvQkFBb0IsQ0FBQ1AsVUFBckI7QUFDQSxDQUZEIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCDCqSBNSUtPIExMQyAtIEFsbCBSaWdodHMgUmVzZXJ2ZWRcbiAqIFVuYXV0aG9yaXplZCBjb3B5aW5nIG9mIHRoaXMgZmlsZSwgdmlhIGFueSBtZWRpdW0gaXMgc3RyaWN0bHkgcHJvaGliaXRlZFxuICogUHJvcHJpZXRhcnkgYW5kIGNvbmZpZGVudGlhbFxuICogV3JpdHRlbiBieSBBbGV4ZXkgUG9ydG5vdiwgOCAyMDIwXG4gKi9cbi8qIGdsb2JhbCBhY2UsIFBieEFwaSAqL1xuXG5cbmNvbnN0IHVwZGF0ZUxvZ1ZpZXdXb3JrZXIgPSB7XG5cdHRpbWVPdXQ6IDMwMDAsXG5cdHRpbWVPdXRIYW5kbGU6ICcnLFxuXHRlcnJvckNvdW50czogMCxcblx0aW5pdGlhbGl6ZSgpIHtcblx0XHR1cGRhdGVMb2dWaWV3V29ya2VyLnJlc3RhcnRXb3JrZXIoKTtcblx0fSxcblx0cmVzdGFydFdvcmtlcigpIHtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHVwZGF0ZUxvZ1ZpZXdXb3JrZXIudGltZW91dEhhbmRsZSk7XG5cdFx0dXBkYXRlTG9nVmlld1dvcmtlci53b3JrZXIoKTtcblx0fSxcblx0d29ya2VyKCkge1xuXHRcdGNvbnN0IGRhdGEgPSBzeXN0ZW1EaWFnbm9zdGljTG9ncy4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWVzJyk7XG5cdFx0UGJ4QXBpLlN5c2xvZ0dldExvZ0Zyb21GaWxlKGRhdGEuZmlsZW5hbWUsIGRhdGEuZmlsdGVyLCBkYXRhLmxpbmVzLCBzeXN0ZW1EaWFnbm9zdGljTG9ncy5jYlVwZGF0ZUxvZ1RleHQpO1xuXHRcdHVwZGF0ZUxvZ1ZpZXdXb3JrZXIudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KFxuXHRcdFx0dXBkYXRlTG9nVmlld1dvcmtlci53b3JrZXIsXG5cdFx0XHR1cGRhdGVMb2dWaWV3V29ya2VyLnRpbWVPdXQsXG5cdFx0KTtcblx0fSxcblx0c3RvcCgpIHtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHVwZGF0ZUxvZ1ZpZXdXb3JrZXIudGltZW91dEhhbmRsZSk7XG5cdH1cbn07XG5cbmNvbnN0IHN5c3RlbURpYWdub3N0aWNMb2dzID0ge1xuXHQkc2hvd0J0bjogJCgnI3Nob3ctbGFzdC1sb2cnKSxcblx0JGRvd25sb2FkQnRuOiAkKCcjZG93bmxvYWQtZmlsZScpLFxuXHQkc2hvd0F1dG9CdG46ICQoJyNzaG93LWxhc3QtbG9nLWF1dG8nKSxcblx0dmlld2VyOiAnJyxcblx0JGZpbGVTZWxlY3REcm9wRG93bjogJCgnI3N5c3RlbS1kaWFnbm9zdGljLWZvcm0gLmZpbGVuYW1lcy1zZWxlY3QnKSxcblx0bG9nc0l0ZW1zOiBbXSxcblx0ZGVmYXVsdExvZ0l0ZW06IG51bGwsXG5cdCRmb3JtT2JqOiAkKCcjc3lzdGVtLWRpYWdub3N0aWMtZm9ybScpLFxuXHQkZmlsZU5hbWU6ICQoJyNzeXN0ZW0tZGlhZ25vc3RpYy1mb3JtIC5maWxlbmFtZScpLFxuXHRpbml0aWFsaXplKCkge1xuXHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLmluaXRpYWxpemVBY2UoKTtcblx0XHRQYnhBcGkuU3lzbG9nR2V0TG9nc0xpc3Qoc3lzdGVtRGlhZ25vc3RpY0xvZ3MuY2JGb3JtYXREcm9wZG93blJlc3VsdHMpO1xuXG5cdFx0c3lzdGVtRGlhZ25vc3RpY0xvZ3MuJHNob3dCdG4ub24oJ2NsaWNrJywgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvbnN0IGRhdGEgPSBzeXN0ZW1EaWFnbm9zdGljTG9ncy4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWVzJyk7XG5cdFx0XHRQYnhBcGkuU3lzbG9nR2V0TG9nRnJvbUZpbGUoZGF0YS5maWxlbmFtZSwgZGF0YS5maWx0ZXIsIGRhdGEubGluZXMsIHN5c3RlbURpYWdub3N0aWNMb2dzLmNiVXBkYXRlTG9nVGV4dCk7XG5cdFx0fSk7XG5cblx0XHRzeXN0ZW1EaWFnbm9zdGljTG9ncy4kZG93bmxvYWRCdG4ub24oJ2NsaWNrJywgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvbnN0IGRhdGEgPSBzeXN0ZW1EaWFnbm9zdGljTG9ncy4kZm9ybU9iai5mb3JtKCdnZXQgdmFsdWVzJyk7XG5cdFx0XHRQYnhBcGkuU3lzbG9nRG93bmxvYWRMb2dGaWxlKGRhdGEuZmlsZW5hbWUsIHN5c3RlbURpYWdub3N0aWNMb2dzLmNiRG93bmxvYWRGaWxlKTtcblx0XHR9KTtcblxuXHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLiRzaG93QXV0b0J0bi5vbignY2xpY2snLCAoZSkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y29uc3QgJHJlbG9hZEljb24gPSBzeXN0ZW1EaWFnbm9zdGljTG9ncy4kc2hvd0F1dG9CdG4uZmluZCgnaS5yZWZyZXNoJyk7XG5cdFx0XHRpZiAoJHJlbG9hZEljb24uaGFzQ2xhc3MoJ2xvYWRpbmcnKSl7XG5cdFx0XHRcdCRyZWxvYWRJY29uLnJlbW92ZUNsYXNzKCdsb2FkaW5nJyk7XG5cdFx0XHRcdHVwZGF0ZUxvZ1ZpZXdXb3JrZXIuc3RvcCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0JHJlbG9hZEljb24uYWRkQ2xhc3MoJ2xvYWRpbmcnKTtcblx0XHRcdFx0dXBkYXRlTG9nVmlld1dvcmtlci5pbml0aWFsaXplKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0sXG5cdGluaXRpYWxpemVBY2UoKSB7XG5cdFx0Y29uc3QgSW5pTW9kZSA9IGFjZS5yZXF1aXJlKCdhY2UvbW9kZS9qdWxpYScpLk1vZGU7XG5cdFx0c3lzdGVtRGlhZ25vc3RpY0xvZ3Mudmlld2VyID0gYWNlLmVkaXQoJ2xvZy1jb250ZW50LXJlYWRvbmx5Jyk7XG5cdFx0c3lzdGVtRGlhZ25vc3RpY0xvZ3Mudmlld2VyLnNldFJlYWRPbmx5KHRydWUpO1xuXHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLnZpZXdlci5zZXNzaW9uLnNldE1vZGUobmV3IEluaU1vZGUoKSk7XG5cdFx0c3lzdGVtRGlhZ25vc3RpY0xvZ3Mudmlld2VyLnNldFRoZW1lKCdhY2UvdGhlbWUvbW9ub2thaScpO1xuXHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLnZpZXdlci5yZXNpemUoKTtcblx0XHRzeXN0ZW1EaWFnbm9zdGljTG9ncy52aWV3ZXIuc2V0U2hvd1ByaW50TWFyZ2luKGZhbHNlKTtcblx0XHRzeXN0ZW1EaWFnbm9zdGljTG9ncy52aWV3ZXIuc2V0T3B0aW9ucyh7XG5cdFx0XHRtYXhMaW5lczogNDUsXG5cdFx0fSk7XG5cdH0sXG5cdC8qKlxuXHQgKiBNYWtlcyBmb3JtYXR0ZWQgbWVudSBzdHJ1Y3R1cmVcblx0ICovXG5cdGNiRm9ybWF0RHJvcGRvd25SZXN1bHRzKHJlc3BvbnNlKSB7XG5cdFx0aWYgKHJlc3BvbnNlID09PWZhbHNlKXtcblx0XHRcdHJldHVybiA7XG5cdFx0fVxuXHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLmxvZ3NJdGVtcyA9IFtdO1xuXHRcdGNvbnN0IGZpbGVzID0gcmVzcG9uc2UuZmlsZXM7XG5cdFx0JC5lYWNoKGZpbGVzLCAoaW5kZXgsIGl0ZW0pID0+IHtcblx0XHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLmxvZ3NJdGVtcy5wdXNoKHtcblx0XHRcdFx0bmFtZTogYCR7aW5kZXh9ICgke2l0ZW0uc2l6ZX0pYCxcblx0XHRcdFx0dmFsdWU6IGl0ZW0ucGF0aCxcblx0XHRcdFx0c2VsZWN0ZWQ6IGl0ZW0uZGVmYXVsdFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3lzdGVtRGlhZ25vc3RpY0xvZ3MuJGZpbGVTZWxlY3REcm9wRG93bi5kcm9wZG93bihcblx0XHRcdHtcblx0XHRcdFx0dmFsdWVzOiBzeXN0ZW1EaWFnbm9zdGljTG9ncy5sb2dzSXRlbXMsXG5cdFx0XHRcdG9uQ2hhbmdlOiBzeXN0ZW1EaWFnbm9zdGljTG9ncy5jYk9uQ2hhbmdlRmlsZSxcblx0XHRcdFx0aWdub3JlQ2FzZTogdHJ1ZSxcblx0XHRcdFx0ZnVsbFRleHRTZWFyY2g6IHRydWUsXG5cdFx0XHRcdGZvcmNlU2VsZWN0aW9uOiBmYWxzZSxcblx0XHRcdH1cblx0XHQpO1xuXHR9LFxuXHQvKipcblx0ICogQ2FsbGJhY2sgYWZ0ZXIgY2hhbmdlIGxvZyBmaWxlIGluIHNlbGVjdFxuXHQgKiBAcGFyYW0gdmFsdWVcblx0ICovXG5cdGNiT25DaGFuZ2VGaWxlKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlLmxlbmd0aD09PTApe1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzeXN0ZW1EaWFnbm9zdGljTG9ncy4kZm9ybU9iai5mb3JtKCdzZXQgdmFsdWUnLCAnZmlsZW5hbWUnLCB2YWx1ZSk7XG5cdFx0Y29uc3QgZGF0YSA9IHN5c3RlbURpYWdub3N0aWNMb2dzLiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcblx0XHRQYnhBcGkuU3lzbG9nR2V0TG9nRnJvbUZpbGUoZGF0YS5maWxlbmFtZSwgZGF0YS5maWx0ZXIsIGRhdGEubGluZXMsIHN5c3RlbURpYWdub3N0aWNMb2dzLmNiVXBkYXRlTG9nVGV4dCk7XG5cdH0sXG5cdC8qKlxuXHQgKiBVcGRhdGVzIGxvZyB2aWV3XG5cdCAqIEBwYXJhbSBkYXRhXG5cdCAqL1xuXHRjYlVwZGF0ZUxvZ1RleHQoZGF0YSkge1xuXHRcdHN5c3RlbURpYWdub3N0aWNMb2dzLnZpZXdlci5nZXRTZXNzaW9uKCkuc2V0VmFsdWUoZGF0YS5jb250ZW50KTtcblx0XHRjb25zdCByb3cgPSBzeXN0ZW1EaWFnbm9zdGljTG9ncy52aWV3ZXIuc2Vzc2lvbi5nZXRMZW5ndGgoKSAtIDE7XG5cdFx0Y29uc3QgY29sdW1uID0gc3lzdGVtRGlhZ25vc3RpY0xvZ3Mudmlld2VyLnNlc3Npb24uZ2V0TGluZShyb3cpLmxlbmd0aDsgLy8gb3Igc2ltcGx5IEluZmluaXR5XG5cdFx0c3lzdGVtRGlhZ25vc3RpY0xvZ3Mudmlld2VyLmdvdG9MaW5lKHJvdyArIDEsIGNvbHVtbik7XG5cdH0sXG5cdC8qKlxuXHQgKiBBZnRlciBwdXNoIGJ1dHRvbiBkb3dubG9hZCBmaWxlXG5cdCAqIEBwYXJhbSByZXNwb25zZVxuXHQgKi9cblx0Y2JEb3dubG9hZEZpbGUocmVzcG9uc2Upe1xuXHRcdGlmIChyZXNwb25zZSE9PWZhbHNlKXtcblx0XHRcdHdpbmRvdy5sb2NhdGlvbiA9IHJlc3BvbnNlLmZpbGVuYW1lO1xuXHRcdH1cblx0fVxufTtcblxuJChkb2N1bWVudCkucmVhZHkoKCkgPT4ge1xuXHRzeXN0ZW1EaWFnbm9zdGljTG9ncy5pbml0aWFsaXplKCk7XG59KTtcblxuIl19