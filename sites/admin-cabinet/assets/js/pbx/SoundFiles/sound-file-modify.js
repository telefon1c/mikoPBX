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

/* global globalRootUrl, globalTranslate, Form, PbxApi, sndPlayer, mergingCheckWorker */

/**
 * Object representing sound file modification functionality.
 *
 * @module soundFileModify
 */
var soundFileModify = {
  trashBin: [],

  /**
   * jQuery object for the sound upload button.
   * @type {jQuery}
   */
  $soundUploadButton: $('#upload-sound-file'),

  /**
   * jQuery object for the sound file input.
   * @type {jQuery}
   */
  $soundFileInput: $('#file'),

  /**
   * jQuery object for the sound file name input.
   * @type {jQuery}
   */
  $soundFileName: $('#name'),

  /**
   * jQuery object for the audio player.
   * @type {jQuery}
   */
  $audioPlayer: $('#audio-player'),

  /**
   * jQuery object for the submit button.
   * @type {jQuery}
   */
  $submitButton: $('#submitbutton'),

  /**
   * The Blob URL object.
   * @type {Blob}
   */
  blob: window.URL || window.webkitURL,

  /**
   * jQuery object for the form.
   * @type {jQuery}
   */
  $formObj: $('#sound-file-form'),

  /**
   * jQuery object for the form dropdowns.
   * @type {jQuery}
   */
  $dropDowns: $('#sound-file-form .dropdown'),

  /**
   * Validation rules for the form fields before submission.
   *
   * @type {object}
   */
  validateRules: {
    description: {
      identifier: 'name',
      rules: [{
        type: 'empty',
        prompt: globalTranslate.sf_ValidationFileNameIsEmpty
      }]
    },
    path: {
      identifier: 'path',
      rules: [{
        type: 'empty',
        prompt: globalTranslate.sf_ValidationFileNotSelected
      }]
    }
  },

  /**
   * Initializes the sound file modification functionality.
   */
  initialize: function initialize() {
    soundFileModify.$dropDowns.dropdown();
    soundFileModify.initializeForm();
    soundFileModify.$soundUploadButton.on('click', function (e) {
      e.preventDefault();
      $('input:file', $(e.target).parents()).click();
    });
    soundFileModify.$soundFileInput.on('change', function (e) {
      var file = e.target.files[0];
      if (file === undefined) return;
      soundFileModify.$soundFileName.val(file.name.replace(/\.[^/.]+$/, ''));
      soundFileModify.blob = window.URL || window.webkitURL;
      var fileURL = soundFileModify.blob.createObjectURL(file);
      sndPlayer.UpdateSource(fileURL);
      PbxApi.FilesUploadFile(file, soundFileModify.cbUploadResumable);
    });
    window.addEventListener('ConfigDataChanged', soundFileModify.cbOnDataChanged);
  },

  /**
   * Clears caches if data changes.
   */
  cbOnDataChanged: function cbOnDataChanged() {
    sessionStorage.removeItem("".concat(globalRootUrl, "sound-files/getSoundFiles/custom"));
    sessionStorage.removeItem("".concat(globalRootUrl, "sound-files/getSoundFiles/moh"));
  },

  /**
   * Callback function for file upload with chunks and merge.
   * @param {string} action - The action performed during the upload.
   * @param {Object} params - Additional parameters related to the upload.
   */
  cbUploadResumable: function cbUploadResumable(action, params) {
    switch (action) {
      case 'fileSuccess':
        var response = PbxApi.tryParseJSON(params.response);

        if (response !== false && response.data.filename !== undefined) {
          soundFileModify.$soundFileName.val(params.file.fileName);
          soundFileModify.checkStatusFileMerging(params.response);
        } else {
          UserMessage.showMultiString(params, globalTranslate.sf_UploadError);
        }

        break;

      case 'uploadStart':
        soundFileModify.$formObj.addClass('loading');
        break;

      case 'error':
        soundFileModify.$submitButton.removeClass('loading');
        soundFileModify.$formObj.removeClass('loading');
        UserMessage.showMultiString(params, globalTranslate.sf_UploadError);
        break;

      default:
    }
  },

  /**
   * Checks the status of file merging.
   * @param {string} response - The response from the file merging status function.
   */
  checkStatusFileMerging: function checkStatusFileMerging(response) {
    if (response === undefined || PbxApi.tryParseJSON(response) === false) {
      UserMessage.showMultiString("".concat(globalTranslate.sf_UploadError));
      return;
    }

    var json = JSON.parse(response);

    if (json === undefined || json.data === undefined) {
      UserMessage.showMultiString("".concat(globalTranslate.sf_UploadError));
      return;
    }

    var fileID = json.data.upload_id;
    var filePath = json.data.filename;
    mergingCheckWorker.initialize(fileID, filePath);
  },

  /**
   * Callback function after the file is converted to MP3 format.
   * @param {string} filename - The filename of the converted file.
   */
  cbAfterConvertFile: function cbAfterConvertFile(filename) {
    if (filename === false) {
      UserMessage.showMultiString("".concat(globalTranslate.sf_UploadError));
    } else {
      soundFileModify.trashBin.push(soundFileModify.$formObj.form('get value', 'path'));
      soundFileModify.$formObj.form('set value', 'path', filename);
      soundFileModify.$soundFileName.trigger('change');
      sndPlayer.UpdateSource("/pbxcore/api/cdr/v2/playback?view=".concat(filename));
      soundFileModify.$submitButton.removeClass('loading');
      soundFileModify.$formObj.removeClass('loading');
    }
  },

  /**
   * Callback function to be called before the form is sent.
   * @param {Object} settings - The current settings of the form.
   * @returns {Object} - The updated settings of the form.
   */
  cbBeforeSendForm: function cbBeforeSendForm(settings) {
    var result = settings;
    result.data = soundFileModify.$formObj.form('get values');
    return result;
  },

  /**
   * Callback function to be called after the form has been sent.
   * @param {Object} response - The response from the server after the form is sent
   */
  cbAfterSendForm: function cbAfterSendForm(response) {
    soundFileModify.trashBin.forEach(function (filepath) {
      if (filepath) PbxApi.FilesRemoveAudioFile(filepath);
    });
    var event = document.createEvent('Event');
    event.initEvent('ConfigDataChanged', false, true);
    window.dispatchEvent(event);
  },

  /**
   * Initialize the form with custom settings
   */
  initializeForm: function initializeForm() {
    var category = soundFileModify.$formObj.form('get value', 'category');
    Form.$formObj = soundFileModify.$formObj;
    Form.url = "".concat(globalRootUrl, "sound-files/save"); // Form submission URL

    Form.validateRules = soundFileModify.validateRules; // Form validation rules

    Form.cbBeforeSendForm = soundFileModify.cbBeforeSendForm; // Callback before form is sent

    Form.cbAfterSendForm = soundFileModify.cbAfterSendForm; // Callback after form is sent

    Form.afterSubmitModifyUrl = "".concat(globalRootUrl, "sound-files/modify/").concat(category);
    Form.afterSubmitIndexUrl = "".concat(globalRootUrl, "sound-files/index/#/").concat(category);
    Form.initialize();
  }
}; // When the document is ready, initialize the sound file modify form

$(document).ready(function () {
  soundFileModify.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Tb3VuZEZpbGVzL3NvdW5kLWZpbGUtbW9kaWZ5LmpzIl0sIm5hbWVzIjpbInNvdW5kRmlsZU1vZGlmeSIsInRyYXNoQmluIiwiJHNvdW5kVXBsb2FkQnV0dG9uIiwiJCIsIiRzb3VuZEZpbGVJbnB1dCIsIiRzb3VuZEZpbGVOYW1lIiwiJGF1ZGlvUGxheWVyIiwiJHN1Ym1pdEJ1dHRvbiIsImJsb2IiLCJ3aW5kb3ciLCJVUkwiLCJ3ZWJraXRVUkwiLCIkZm9ybU9iaiIsIiRkcm9wRG93bnMiLCJ2YWxpZGF0ZVJ1bGVzIiwiZGVzY3JpcHRpb24iLCJpZGVudGlmaWVyIiwicnVsZXMiLCJ0eXBlIiwicHJvbXB0IiwiZ2xvYmFsVHJhbnNsYXRlIiwic2ZfVmFsaWRhdGlvbkZpbGVOYW1lSXNFbXB0eSIsInBhdGgiLCJzZl9WYWxpZGF0aW9uRmlsZU5vdFNlbGVjdGVkIiwiaW5pdGlhbGl6ZSIsImRyb3Bkb3duIiwiaW5pdGlhbGl6ZUZvcm0iLCJvbiIsImUiLCJwcmV2ZW50RGVmYXVsdCIsInRhcmdldCIsInBhcmVudHMiLCJjbGljayIsImZpbGUiLCJmaWxlcyIsInVuZGVmaW5lZCIsInZhbCIsIm5hbWUiLCJyZXBsYWNlIiwiZmlsZVVSTCIsImNyZWF0ZU9iamVjdFVSTCIsInNuZFBsYXllciIsIlVwZGF0ZVNvdXJjZSIsIlBieEFwaSIsIkZpbGVzVXBsb2FkRmlsZSIsImNiVXBsb2FkUmVzdW1hYmxlIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNiT25EYXRhQ2hhbmdlZCIsInNlc3Npb25TdG9yYWdlIiwicmVtb3ZlSXRlbSIsImdsb2JhbFJvb3RVcmwiLCJhY3Rpb24iLCJwYXJhbXMiLCJyZXNwb25zZSIsInRyeVBhcnNlSlNPTiIsImRhdGEiLCJmaWxlbmFtZSIsImZpbGVOYW1lIiwiY2hlY2tTdGF0dXNGaWxlTWVyZ2luZyIsIlVzZXJNZXNzYWdlIiwic2hvd011bHRpU3RyaW5nIiwic2ZfVXBsb2FkRXJyb3IiLCJhZGRDbGFzcyIsInJlbW92ZUNsYXNzIiwianNvbiIsIkpTT04iLCJwYXJzZSIsImZpbGVJRCIsInVwbG9hZF9pZCIsImZpbGVQYXRoIiwibWVyZ2luZ0NoZWNrV29ya2VyIiwiY2JBZnRlckNvbnZlcnRGaWxlIiwicHVzaCIsImZvcm0iLCJ0cmlnZ2VyIiwiY2JCZWZvcmVTZW5kRm9ybSIsInNldHRpbmdzIiwicmVzdWx0IiwiY2JBZnRlclNlbmRGb3JtIiwiZm9yRWFjaCIsImZpbGVwYXRoIiwiRmlsZXNSZW1vdmVBdWRpb0ZpbGUiLCJldmVudCIsImRvY3VtZW50IiwiY3JlYXRlRXZlbnQiLCJpbml0RXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiY2F0ZWdvcnkiLCJGb3JtIiwidXJsIiwiYWZ0ZXJTdWJtaXRNb2RpZnlVcmwiLCJhZnRlclN1Ym1pdEluZGV4VXJsIiwicmVhZHkiXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBTUEsZUFBZSxHQUFHO0FBQ3BCQyxFQUFBQSxRQUFRLEVBQUUsRUFEVTs7QUFHcEI7QUFDSjtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsa0JBQWtCLEVBQUVDLENBQUMsQ0FBQyxvQkFBRCxDQVBEOztBQVNwQjtBQUNKO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxlQUFlLEVBQUVELENBQUMsQ0FBQyxPQUFELENBYkU7O0FBZXBCO0FBQ0o7QUFDQTtBQUNBO0FBQ0lFLEVBQUFBLGNBQWMsRUFBRUYsQ0FBQyxDQUFDLE9BQUQsQ0FuQkc7O0FBcUJwQjtBQUNKO0FBQ0E7QUFDQTtBQUNJRyxFQUFBQSxZQUFZLEVBQUVILENBQUMsQ0FBQyxlQUFELENBekJLOztBQTJCcEI7QUFDSjtBQUNBO0FBQ0E7QUFDSUksRUFBQUEsYUFBYSxFQUFFSixDQUFDLENBQUMsZUFBRCxDQS9CSTs7QUFpQ3BCO0FBQ0o7QUFD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cUJkLGVBQWUsQ0FBQ2MsYUFBckMsQ0FKYSxDQUl1Qzs7QUFDcEQwRSxJQUFBQSxJQUFJLENBQUNiLGdCQUFMLEdBQXdCM0UsZUFBZSxDQUFDMkUsZ0JBQXhDLENBTGEsQ0FLNkM7O0FBQzFEYSxJQUFBQSxJQUFJLENBQUNWLGVBQUwsR0FBdUI5RSxlQUFlLENBQUM4RSxlQUF2QyxDQU5hLENBTTJDOztBQUN4RFUsSUFBQUEsSUFBSSxDQUFDRSxvQkFBTCxhQUErQnhDLGFBQS9CLGdDQUFrRXFDLFFBQWxFO0FBQ0FDLElBQUFBLElBQUksQ0FBQ0csbUJBQUwsYUFBOEJ6QyxhQUE5QixpQ0FBa0VxQyxRQUFsRTtBQUNBQyxJQUFBQSxJQUFJLENBQUNoRSxVQUFMO0FBQ0g7QUF0Tm1CLENBQXhCLEMsQ0F5TkE7O0FBQ0FyQixDQUFDLENBQUNnRixRQUFELENBQUQsQ0FBWVMsS0FBWixDQUFrQixZQUFNO0FBQ3BCNUYsRUFBQUEsZUFBZSxDQUFDd0IsVUFBaEI7QUFDSCxDQUZEIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIE1pa29QQlggLSBmcmVlIHBob25lIHN5c3RlbSBmb3Igc21hbGwgYnVzaW5lc3NcbiAqIENvcHlyaWdodCDCqSAyMDE3LTIwMjMgQWxleGV5IFBvcnRub3YgYW5kIE5pa29sYXkgQmVrZXRvdlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG4gKiBpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuICogdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbjsgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3JcbiAqIChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG4gKiBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuICogTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuICogR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwczovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cblxuLyogZ2xvYmFsIGdsb2JhbFJvb3RVcmwsIGdsb2JhbFRyYW5zbGF0ZSwgRm9ybSwgUGJ4QXBpLCBzbmRQbGF5ZXIsIG1lcmdpbmdDaGVja1dvcmtlciAqL1xuXG4vKipcbiAqIE9iamVjdCByZXByZXNlbnRpbmcgc291bmQgZmlsZSBtb2RpZmljYXRpb24gZnVuY3Rpb25hbGl0eS5cbiAqXG4gKiBAbW9kdWxlIHNvdW5kRmlsZU1vZGlmeVxuICovXG5jb25zdCBzb3VuZEZpbGVNb2RpZnkgPSB7XG4gICAgdHJhc2hCaW46IFtdLFxuXG4gICAgLyoqXG4gICAgICogalF1ZXJ5IG9iamVjdCBmb3IgdGhlIHNvdW5kIHVwbG9hZCBidXR0b24uXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkc291bmRVcGxvYWRCdXR0b246ICQoJyN1cGxvYWQtc291bmQtZmlsZScpLFxuXG4gICAgLyoqXG4gICAgICogalF1ZXJ5IG9iamVjdCBmb3IgdGhlIHNvdW5kIGZpbGUgaW5wdXQuXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkc291bmRGaWxlSW5wdXQ6ICQoJyNmaWxlJyksXG5cbiAgICAvKipcbiAgICAgKiBqUXVlcnkgb2JqZWN0IGZvciB0aGUgc291bmQgZmlsZSBuYW1lIGlucHV0LlxuICAgICAqIEB0eXBlIHtqUXVlcnl9XG4gICAgICovXG4gICAgJHNvdW5kRmlsZU5hbWU6ICQoJyNuYW1lJyksXG5cbiAgICAvKipcbiAgICAgKiBqUXVlcnkgb2JqZWN0IGZvciB0aGUgYXVkaW8gcGxheWVyLlxuICAgICAqIEB0eXBlIHtqUXVlcnl9XG4gICAgICovXG4gICAgJGF1ZGlvUGxheWVyOiAkKCcjYXVkaW8tcGxheWVyJyksXG5cbiAgICAvKipcbiAgICAgKiBqUXVlcnkgb2JqZWN0IGZvciB0aGUgc3VibWl0IGJ1dHRvbi5cbiAgICAgKiBAdHlwZSB7alF1ZXJ5fVxuICAgICAqL1xuICAgICRzdWJtaXRCdXR0b246ICQoJyNzdWJtaXRidXR0b24nKSxcblxuICAgIC8qKlxuICAgICAqIFRoZSBCbG9iIFVSTCBvYmplY3QuXG4gICAgICogQHR5cGUge0Jsb2J9XG4gICAgICovXG4gICAgYmxvYjogd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMLFxuXG4gICAgLyoqXG4gICAgICogalF1ZXJ5IG9iamVjdCBmb3IgdGhlIGZvcm0uXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkZm9ybU9iajogJCgnI3NvdW5kLWZpbGUtZm9ybScpLFxuXG5cbiAgICAvKipcbiAgICAgKiBqUXVlcnkgb2JqZWN0IGZvciB0aGUgZm9ybSBkcm9wZG93bnMuXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkZHJvcERvd25zOiAkKCcjc291bmQtZmlsZS1mb3JtIC5kcm9wZG93bicpLFxuXG4gICAgLyoqXG4gICAgICogVmFsaWRhdGlvbiBydWxlcyBmb3IgdGhlIGZvcm0gZmllbGRzIGJlZm9yZSBzdWJtaXNzaW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICB2YWxpZGF0ZVJ1bGVzOiB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiB7XG4gICAgICAgICAgICBpZGVudGlmaWVyOiAnbmFtZScsXG4gICAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2VtcHR5JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUuc2ZfVmFsaWRhdGlvbkZpbGVOYW1lSXNFbXB0eSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgcGF0aDoge1xuICAgICAgICAgICAgaWRlbnRpZmllcjogJ3BhdGgnLFxuICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdlbXB0eScsXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLnNmX1ZhbGlkYXRpb25GaWxlTm90U2VsZWN0ZWQsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIHRoZSBzb3VuZCBmaWxlIG1vZGlmaWNhdGlvbiBmdW5jdGlvbmFsaXR5LlxuICAgICAqL1xuICAgIGluaXRpYWxpemUoKSB7XG4gICAgICAgIHNvdW5kRmlsZU1vZGlmeS4kZHJvcERvd25zLmRyb3Bkb3duKCk7XG4gICAgICAgIHNvdW5kRmlsZU1vZGlmeS5pbml0aWFsaXplRm9ybSgpO1xuXG4gICAgICAgIHNvdW5kRmlsZU1vZGlmeS4kc291bmRVcGxvYWRCdXR0b24ub24oJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICQoJ2lucHV0OmZpbGUnLCAkKGUudGFyZ2V0KS5wYXJlbnRzKCkpLmNsaWNrKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNvdW5kRmlsZU1vZGlmeS4kc291bmRGaWxlSW5wdXQub24oJ2NoYW5nZScsIChlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZS50YXJnZXQuZmlsZXNbMF07XG4gICAgICAgICAgICBpZiAoZmlsZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgICAgICBzb3VuZEZpbGVNb2RpZnkuJHNvdW5kRmlsZU5hbWUudmFsKGZpbGUubmFtZS5yZXBsYWNlKC9cXC5bXi8uXSskLywgJycpKTtcbiAgICAgICAgICAgIHNvdW5kRmlsZU1vZGlmeS5ibG9iID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMO1xuICAgICAgICAgICAgY29uc3QgZmlsZVVSTCA9IHNvdW5kRmlsZU1vZGlmeS5ibG9iLmNyZWF0ZU9iamVjdFVSTChmaWxlKTtcbiAgICAgICAgICAgIHNuZFBsYXllci5VcGRhdGVTb3VyY2UoZmlsZVVSTCk7XG4gICAgICAgICAgICBQYnhBcGkuRmlsZXNVcGxvYWRGaWxlKGZpbGUsIHNvdW5kRmlsZU1vZGlmeS5jYlVwbG9hZFJlc3VtYWJsZSk7XG5cbiAgICAgICAgfSk7XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdDb25maWdEYXRhQ2hhbmdlZCcsIHNvdW5kRmlsZU1vZGlmeS5jYk9uRGF0YUNoYW5nZWQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgY2FjaGVzIGlmIGRhdGEgY2hhbmdlcy5cbiAgICAgKi9cbiAgICBjYk9uRGF0YUNoYW5nZWQoKSB7XG4gICAgICAgIHNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oYCR7Z2xvYmFsUm9vdFVybH1zb3VuZC1maWxlcy9nZXRTb3VuZEZpbGVzL2N1c3RvbWApO1xuICAgICAgICBzZXNzaW9uU3RvcmFnZS5yZW1vdmVJdGVtKGAke2dsb2JhbFJvb3RVcmx9c291bmQtZmlsZXMvZ2V0U291bmRGaWxlcy9tb2hgKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsbGJhY2sgZnVuY3Rpb24gZm9yIGZpbGUgdXBsb2FkIHdpdGggY2h1bmtzIGFuZCBtZXJnZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uIC0gVGhlIGFjdGlvbiBwZXJmb3JtZWQgZHVyaW5nIHRoZSB1cGxvYWQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyAtIEFkZGl0aW9uYWwgcGFyYW1ldGVycyByZWxhdGVkIHRvIHRoZSB1cGxvYWQuXG4gICAgICovXG4gICAgY2JVcGxvYWRSZXN1bWFibGUoYWN0aW9uLCBwYXJhbXMpIHtcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcbiAgICAgICAgICAgIGNhc2UgJ2ZpbGVTdWNjZXNzJzpcbiAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IFBieEFwaS50cnlQYXJzZUpTT04ocGFyYW1zLnJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UgIT09IGZhbHNlICYmIHJlc3BvbnNlLmRhdGEuZmlsZW5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBzb3VuZEZpbGVNb2RpZnkuJHNvdW5kRmlsZU5hbWUudmFsKHBhcmFtcy5maWxlLmZpbGVOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgc291bmRGaWxlTW9kaWZ5LmNoZWNrU3RhdHVzRmlsZU1lcmdpbmcocGFyYW1zLnJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBVc2VyTWVzc2FnZS5zaG93TXVsdGlTdHJpbmcocGFyYW1zLCBnbG9iYWxUcmFuc2xhdGUuc2ZfVXBsb2FkRXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndXBsb2FkU3RhcnQnOlxuICAgICAgICAgICAgICAgIHNvdW5kRmlsZU1vZGlmeS4kZm9ybU9iai5hZGRDbGFzcygnbG9hZGluZycpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgICAgIHNvdW5kRmlsZU1vZGlmeS4kc3VibWl0QnV0dG9uLnJlbW92ZUNsYXNzKCdsb2FkaW5nJyk7XG4gICAgICAgICAgICAgICAgc291bmRGaWxlTW9kaWZ5LiRmb3JtT2JqLnJlbW92ZUNsYXNzKCdsb2FkaW5nJyk7XG4gICAgICAgICAgICAgICAgVXNlck1lc3NhZ2Uuc2hvd011bHRpU3RyaW5nKHBhcmFtcywgZ2xvYmFsVHJhbnNsYXRlLnNmX1VwbG9hZEVycm9yKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHRoZSBzdGF0dXMgb2YgZmlsZSBtZXJnaW5nLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSByZXNwb25zZSAtIFRoZSByZXNwb25zZSBmcm9tIHRoZSBmaWxlIG1lcmdpbmcgc3RhdHVzIGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIGNoZWNrU3RhdHVzRmlsZU1lcmdpbmcocmVzcG9uc2UpIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlID09PSB1bmRlZmluZWQgfHwgUGJ4QXBpLnRyeVBhcnNlSlNPTihyZXNwb25zZSkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBVc2VyTWVzc2FnZS5zaG93TXVsdGlTdHJpbmcoYCR7Z2xvYmFsVHJhbnNsYXRlLnNmX1VwbG9hZEVycm9yfWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKHJlc3BvbnNlKTtcbiAgICAgICAgaWYgKGpzb24gPT09IHVuZGVmaW5lZCB8fCBqc29uLmRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgVXNlck1lc3NhZ2Uuc2hvd011bHRpU3RyaW5nKGAke2dsb2JhbFRyYW5zbGF0ZS5zZl9VcGxvYWRFcnJvcn1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmaWxlSUQgPSBqc29uLmRhdGEudXBsb2FkX2lkO1xuICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpzb24uZGF0YS5maWxlbmFtZTtcbiAgICAgICAgbWVyZ2luZ0NoZWNrV29ya2VyLmluaXRpYWxpemUoZmlsZUlELCBmaWxlUGF0aCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIGZ1bmN0aW9uIGFmdGVyIHRoZSBmaWxlIGlzIGNvbnZlcnRlZCB0byBNUDMgZm9ybWF0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlbmFtZSAtIFRoZSBmaWxlbmFtZSBvZiB0aGUgY29udmVydGVkIGZpbGUuXG4gICAgICovXG4gICAgY2JBZnRlckNvbnZlcnRGaWxlKGZpbGVuYW1lKSB7XG4gICAgICAgIGlmIChmaWxlbmFtZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIFVzZXJNZXNzYWdlLnNob3dNdWx0aVN0cmluZyhgJHtnbG9iYWxUcmFuc2xhdGUuc2ZfVXBsb2FkRXJyb3J9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzb3VuZEZpbGVNb2RpZnkudHJhc2hCaW4ucHVzaChzb3VuZEZpbGVNb2RpZnkuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlJywgJ3BhdGgnKSk7XG4gICAgICAgICAgICBzb3VuZEZpbGVNb2RpZnkuJGZvcm1PYmouZm9ybSgnc2V0IHZhbHVlJywgJ3BhdGgnLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICBzb3VuZEZpbGVNb2RpZnkuJHNvdW5kRmlsZU5hbWUudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgICAgICBzbmRQbGF5ZXIuVXBkYXRlU291cmNlKGAvcGJ4Y29yZS9hcGkvY2RyL3YyL3BsYXliYWNrP3ZpZXc9JHtmaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIHNvdW5kRmlsZU1vZGlmeS4kc3VibWl0QnV0dG9uLnJlbW92ZUNsYXNzKCdsb2FkaW5nJyk7XG4gICAgICAgICAgICBzb3VuZEZpbGVNb2RpZnkuJGZvcm1PYmoucmVtb3ZlQ2xhc3MoJ2xvYWRpbmcnKTtcblxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBiZWZvcmUgdGhlIGZvcm0gaXMgc2VudC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgLSBUaGUgY3VycmVudCBzZXR0aW5ncyBvZiB0aGUgZm9ybS5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAtIFRoZSB1cGRhdGVkIHNldHRpbmdzIG9mIHRoZSBmb3JtLlxuICAgICAqL1xuICAgIGNiQmVmb3JlU2VuZEZvcm0oc2V0dGluZ3MpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gc2V0dGluZ3M7XG4gICAgICAgIHJlc3VsdC5kYXRhID0gc291bmRGaWxlTW9kaWZ5LiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsbGJhY2sgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBmb3JtIGhhcyBiZWVuIHNlbnQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIC0gVGhlIHJlc3BvbnNlIGZyb20gdGhlIHNlcnZlciBhZnRlciB0aGUgZm9ybSBpcyBzZW50XG4gICAgICovXG4gICAgY2JBZnRlclNlbmRGb3JtKHJlc3BvbnNlKSB7XG4gICAgICAgIHNvdW5kRmlsZU1vZGlmeS50cmFzaEJpbi5mb3JFYWNoKChmaWxlcGF0aCkgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGVwYXRoKSBQYnhBcGkuRmlsZXNSZW1vdmVBdWRpb0ZpbGUoZmlsZXBhdGgpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnRXZlbnQnKTtcbiAgICAgICAgZXZlbnQuaW5pdEV2ZW50KCdDb25maWdEYXRhQ2hhbmdlZCcsIGZhbHNlLCB0cnVlKTtcbiAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBmb3JtIHdpdGggY3VzdG9tIHNldHRpbmdzXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUZvcm0oKSB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gc291bmRGaWxlTW9kaWZ5LiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZScsICdjYXRlZ29yeScpO1xuICAgICAgICBGb3JtLiRmb3JtT2JqID0gc291bmRGaWxlTW9kaWZ5LiRmb3JtT2JqO1xuICAgICAgICBGb3JtLnVybCA9IGAke2dsb2JhbFJvb3RVcmx9c291bmQtZmlsZXMvc2F2ZWA7IC8vIEZvcm0gc3VibWlzc2lvbiBVUkxcbiAgICAgICAgRm9ybS52YWxpZGF0ZVJ1bGVzID0gc291bmRGaWxlTW9kaWZ5LnZhbGlkYXRlUnVsZXM7IC8vIEZvcm0gdmFsaWRhdGlvbiBydWxlc1xuICAgICAgICBGb3JtLmNiQmVmb3JlU2VuZEZvcm0gPSBzb3VuZEZpbGVNb2RpZnkuY2JCZWZvcmVTZW5kRm9ybTsgLy8gQ2FsbGJhY2sgYmVmb3JlIGZvcm0gaXMgc2VudFxuICAgICAgICBGb3JtLmNiQWZ0ZXJTZW5kRm9ybSA9IHNvdW5kRmlsZU1vZGlmeS5jYkFmdGVyU2VuZEZvcm07IC8vIENhbGxiYWNrIGFmdGVyIGZvcm0gaXMgc2VudFxuICAgICAgICBGb3JtLmFmdGVyU3VibWl0TW9kaWZ5VXJsID0gYCR7Z2xvYmFsUm9vdFVybH1zb3VuZC1maWxlcy9tb2RpZnkvJHtjYXRlZ29yeX1gO1xuICAgICAgICBGb3JtLmFmdGVyU3VibWl0SW5kZXhVcmwgPSBgJHtnbG9iYWxSb290VXJsfXNvdW5kLWZpbGVzL2luZGV4LyMvJHtjYXRlZ29yeX1gO1xuICAgICAgICBGb3JtLmluaXRpYWxpemUoKTtcbiAgICB9LFxufTtcblxuLy8gV2hlbiB0aGUgZG9jdW1lbnQgaXMgcmVhZHksIGluaXRpYWxpemUgdGhlIHNvdW5kIGZpbGUgbW9kaWZ5IGZvcm1cbiQoZG9jdW1lbnQpLnJlYWR5KCgpID0+IHtcbiAgICBzb3VuZEZpbGVNb2RpZnkuaW5pdGlhbGl6ZSgpO1xufSk7XG4iXX0=