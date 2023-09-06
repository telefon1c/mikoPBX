"use strict";

/*
 * MikoPBX - free phone system for small business
 * Copyright (C) 2017-2020 Alexey Portnov and Nikolay Beketov
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

/* global Sentry, globalPBXVersion, globalPBXLicense,
globalLastSentryEventId, globalTranslate, localStorage */
function globalShowSentryReportDialog(hash, sentryEventId) {
  var itIsKnownError = localStorage.getItem("sentry_lastError".concat(hash));

  if (itIsKnownError === null) {
    if (typeof {
      globalTranslate: globalTranslate
    } !== "undefined" && Object.keys(globalTranslate).length > 0) {
      Sentry.showReportDialog({
        eventId: sentryEventId,
        title: globalTranslate.sntry_Title,
        subtitle: globalTranslate.sntry_Subtitle,
        subtitle2: globalTranslate.sntry_Subtitle2,
        labelComments: globalTranslate.sntry_LabelComments,
        labelClose: globalTranslate.sntry_LabelClose,
        labelSubmit: globalTranslate.sntry_LabelSubmit,
        errorGeneric: globalTranslate.sntry_ErrorGeneric,
        errorFormEntry: globalTranslate.sntry_ErrorFormEntry,
        successMessage: globalTranslate.sntry_SuccessMessage
      });
    } else {
      Sentry.showReportDialog({
        eventId: sentryEventId
      });
    }

    localStorage.setItem("sentry_lastError".concat(hash), 'theFormHasAlreadySent');
  }
}

Sentry.onLoad(function () {
  Sentry.init({
    dsn: 'https://07be0eff8a5c463fbac3e90ae5c7d039@sentry.miko.ru/1',
    release: "mikopbx@".concat(globalPBXVersion),
    beforeSend: function () {
      function beforeSend(event, hint) {
        // Check if it is an exception, and if so, show the report dialog
        if (event.exception) {
          var error = hint.originalException;

          if (error && error.message && error.message.length > 0) {
            var s = error.message;
            var hash = 0;
            var i;
            var chr;

            for (i = 0; i < s.length; i++) {
              chr = s.charCodeAt(i);
              hash = (hash << 5) - hash + chr;
              hash |= 0; // Convert to 32bit integer
            }

            globalShowSentryReportDialog(hash, hint.eventId);
          }
        }

        return event;
      }

      return beforeSend;
    }()
  });
  Sentry.configureScope(function (scope) {
    scope.setUser({
      id: globalPBXLicense
    });
    scope.setTag('library', 'web-interface');
  });

  if (globalLastSentryEventId) {
    globalShowSentryReportDialog(globalLastSentryEventId);
  }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tYWluL3NlbnRyeS1lcnJvci1sb2dnZXIuanMiXSwibmFtZXMiOlsiZ2xvYmFsU2hvd1NlbnRyeVJlcG9ydERpYWxvZyIsImhhc2giLCJzZW50cnlFdmVudElkIiwiaXRJc0tub3duRXJyb3IiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiZ2xvYmFsVHJhbnNsYXRlIiwiT2JqZWN0Iiwia2V5cyIsImxlbmd0aCIsIlNlbnRyeSIsInNob3dSZXBvcnREaWFsb2ciLCJldmVudElkIiwidGl0bGUiLCJzbnRyeV9UaXRsZSIsInN1YnRpdGxlIiwic250cnlfU3VidGl0bGUiLCJzdWJ0aXRsZTIiLCJzbnRyeV9TdWJ0aXRsZTIiLCJsYWJlbENvbW1lbnRzIiwic250cnlfTGFiZWxDb21tZW50cyIsImxhYmVsQ2xvc2UiLCJzbnRyeV9MYWJlbENsb3NlIiwibGFiZWxTdWJtaXQiLCJzbnRyeV9MYWJlbFN1Ym1pdCIsImVycm9yR2VuZXJpYyIsInNudHJ5X0Vycm9yR2VuZXJpYyIsImVycm9yRm9ybUVudHJ5Iiwic250cnlfRXJyb3JGb3JtRW50cnkiLCJzdWNjZXNzTWVzc2FnZSIsInNudHJ5X1N1Y2Nlc3NNZXNzYWdlIiwic2V0SXRlbSIsIm9uTG9hZCIsImluaXQiLCJkc24iLCJyZWxlYXNlIiwiZ2xvYmFsUEJYVmVyc2lvbiIsImJlZm9yZVNlbmQiLCJldmVudCIsImhpbnQiLCJleGNlcHRpb24iLCJlcnJvciIsIm9yaWdpbmFsRXhjZXB0aW9uIiwibWVzc2FnZSIsInMiLCJpIiwiY2hyIiwiY2hhckNvZGVBdCIsImNvbmZpZ3VyZVNjb3BlIiwic2NvcGUiLCJzZXRVc2VyIiwiaWQiLCJnbG9iYWxQQlhMaWNlbnNlIiwic2V0VGFnIiwiZ2xvYmFsTGFzdFNlbnRyeUV2ZW50SWQiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1CQTs7QUFHQSxTQUFTQSw0QkFBVCxDQUFzQ0MsSUFBdEMsRUFBNENDLGFBQTVDLEVB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SSxNQUFOLENBQWEsU0FBYixFQUF3QixlQUF4QjtBQUNBLEdBSEQ7O0FBS0EsTUFBSUMsdUJBQUosRUFBNkI7QUFDNUJ0RCxJQUFBQSw0QkFBNEIsQ0FBQ3NELHVCQUFELENBQTVCO0FBQ0E7QUFDRCxDQWxDRCIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBNaWtvUEJYIC0gZnJlZSBwaG9uZSBzeXN0ZW0gZm9yIHNtYWxsIGJ1c2luZXNzXG4gKiBDb3B5cmlnaHQgKEMpIDIwMTctMjAyMCBBbGV4ZXkgUG9ydG5vdiBhbmQgTmlrb2xheSBCZWtldG92XG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcbiAqIGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG4gKiB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uOyBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuICogKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG4gKiBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHBzOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiAqL1xuXG5cbi8qIGdsb2JhbCBTZW50cnksIGdsb2JhbFBCWFZlcnNpb24sIGdsb2JhbFBCWExpY2Vuc2UsXG5nbG9iYWxMYXN0U2VudHJ5RXZlbnRJZCwgZ2xvYmFsVHJhbnNsYXRlLCBsb2NhbFN0b3JhZ2UgKi9cblxuZnVuY3Rpb24gZ2xvYmFsU2hvd1NlbnRyeVJlcG9ydERpYWxvZyhoYXNoLCBzZW50cnlFdmVudElkKSB7XG5cdGNvbnN0IGl0SXNLbm93bkVycm9yID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oYHNlbnRyeV9sYXN0RXJyb3Ike2hhc2h9YCk7XG5cdGlmIChpdElzS25vd25FcnJvciA9PT0gbnVsbCkge1xuXHRcdGlmICh0eXBlb2Yge2dsb2JhbFRyYW5zbGF0ZX0gIT09IFwidW5kZWZpbmVkXCJcblx0XHRcdCYmIE9iamVjdC5rZXlzKGdsb2JhbFRyYW5zbGF0ZSkubGVuZ3RoID4gMCkge1xuXHRcdFx0U2VudHJ5LnNob3dSZXBvcnREaWFsb2coe1xuXHRcdFx0XHRldmVudElkOiBzZW50cnlFdmVudElkLFxuXHRcdFx0XHR0aXRsZTogZ2xvYmFsVHJhbnNsYXRlLnNudHJ5X1RpdGxlLFxuXHRcdFx0XHRzdWJ0aXRsZTogZ2xvYmFsVHJhbnNsYXRlLnNudHJ5X1N1YnRpdGxlLFxuXHRcdFx0XHRzdWJ0aXRsZTI6IGdsb2JhbFRyYW5zbGF0ZS5zbnRyeV9TdWJ0aXRsZTIsXG5cdFx0XHRcdGxhYmVsQ29tbWVudHM6IGdsb2JhbFRyYW5zbGF0ZS5zbnRyeV9MYWJlbENvbW1lbnRzLFxuXHRcdFx0XHRsYWJlbENsb3NlOiBnbG9iYWxUcmFuc2xhdGUuc250cnlfTGFiZWxDbG9zZSxcblx0XHRcdFx0bGFiZWxTdWJtaXQ6IGdsb2JhbFRyYW5zbGF0ZS5zbnRyeV9MYWJlbFN1Ym1pdCxcblx0XHRcdFx0ZXJyb3JHZW5lcmljOiBnbG9iYWxUcmFuc2xhdGUuc250cnlfRXJyb3JHZW5lcmljLFxuXHRcdFx0XHRlcnJvckZvcm1FbnRyeTogZ2xvYmFsVHJhbnNsYXRlLnNudHJ5X0Vycm9yRm9ybUVudHJ5LFxuXHRcdFx0XHRzdWNjZXNzTWVzc2FnZTogZ2xvYmFsVHJhbnNsYXRlLnNudHJ5X1N1Y2Nlc3NNZXNzYWdlLFxuXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0U2VudHJ5LnNob3dSZXBvcnREaWFsb2coeyBldmVudElkOiBzZW50cnlFdmVudElkIH0pO1xuXHRcdH1cblx0XHRsb2NhbFN0b3JhZ2Uuc2V0SXRlbShgc2VudHJ5X2xhc3RFcnJvciR7aGFzaH1gLCAndGhlRm9ybUhhc0FscmVhZHlTZW50Jyk7XG5cdH1cbn1cblxuU2VudHJ5Lm9uTG9hZCgoKSA9PiB7XG5cdFNlbnRyeS5pbml0KHtcblx0XHRkc246ICdodHRwczovLzA3YmUwZWZmOGE1YzQ2M2ZiYWMzZTkwYWU1YzdkMDM5QHNlbnRyeS5taWtvLnJ1LzEnLFxuXHRcdHJlbGVhc2U6IGBtaWtvcGJ4QCR7Z2xvYmFsUEJYVmVyc2lvbn1gLFxuXHRcdGJlZm9yZVNlbmQoZXZlbnQsIGhpbnQpIHtcblx0XHRcdC8vIENoZWNrIGlmIGl0IGlzIGFuIGV4Y2VwdGlvbiwgYW5kIGlmIHNvLCBzaG93IHRoZSByZXBvcnQgZGlhbG9nXG5cdFx0XHRpZiAoZXZlbnQuZXhjZXB0aW9uKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yID0gaGludC5vcmlnaW5hbEV4Y2VwdGlvbjtcblx0XHRcdFx0aWYgKGVycm9yICYmIGVycm9yLm1lc3NhZ2UgJiYgZXJyb3IubWVzc2FnZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3QgcyA9IGVycm9yLm1lc3NhZ2U7XG5cdFx0XHRcdFx0bGV0IGhhc2ggPSAwO1xuXHRcdFx0XHRcdGxldCBpO1xuXHRcdFx0XHRcdGxldCBjaHI7XG5cdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGNociA9IHMuY2hhckNvZGVBdChpKTtcblx0XHRcdFx0XHRcdGhhc2ggPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIGNocjtcblx0XHRcdFx0XHRcdGhhc2ggfD0gMDsgLy8gQ29udmVydCB0byAzMmJpdCBpbnRlZ2VyXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGdsb2JhbFNob3dTZW50cnlSZXBvcnREaWFsb2coaGFzaCwgaGludC5ldmVudElkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZXZlbnQ7XG5cdFx0fSxcblx0fSk7XG5cblx0U2VudHJ5LmNvbmZpZ3VyZVNjb3BlKChzY29wZSkgPT4ge1xuXHRcdHNjb3BlLnNldFVzZXIoeyBpZDogZ2xvYmFsUEJYTGljZW5zZSB9KTtcblx0XHRzY29wZS5zZXRUYWcoJ2xpYnJhcnknLCAnd2ViLWludGVyZmFjZScpO1xuXHR9KTtcblxuXHRpZiAoZ2xvYmFsTGFzdFNlbnRyeUV2ZW50SWQpIHtcblx0XHRnbG9iYWxTaG93U2VudHJ5UmVwb3J0RGlhbG9nKGdsb2JhbExhc3RTZW50cnlFdmVudElkKTtcblx0fVxufSk7XG5cbiJdfQ==