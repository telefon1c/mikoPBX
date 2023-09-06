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

/* global globalRootUrl, globalTranslate, Form, $, ClipboardJS */
// custom form validation rule
$.fn.form.settings.rules.username = function (noregister, username) {
  return !(username.length === 0 && noregister !== 'on');
};

var provider = {
  $formObj: $('#save-provider-form'),
  $secret: $('#secret'),
  $dirrtyField: $('#dirrty'),
  providerType: $('#providerType').val(),
  $checkBoxes: $('#save-provider-form .checkbox'),
  $accordions: $('#save-provider-form .ui.accordion'),
  $dropDowns: $('#save-provider-form .ui.dropdown'),
  $deleteRowButton: $('#additional-hosts-table .delete-row-button'),
  $qualifyToggle: $('#qualify'),
  $qualifyFreqToggle: $('#qualify-freq'),
  $additionalHostInput: $('#additional-host input'),
  hostInputValidation: /^((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(\d|[1-2]\d|3[0-2]))?|[a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+)$/gm,
  hostRow: '#save-provider-form .host-row',
  validateRules: {
    description: {
      identifier: 'description',
      rules: [{
        type: 'empty',
        prompt: globalTranslate.pr_ValidationProviderNameIsEmpty
      }]
    },
    host: {
      identifier: 'host',
      rules: [{
        type: 'checkHostProvider',
        prompt: globalTranslate.pr_ValidationProviderHostIsEmpty
      }]
    },
    username: {
      identifier: 'username',
      optional: true,
      rules: [{
        type: 'minLength[2]',
        prompt: globalTranslate.pr_ValidationProviderLoginNotSingleSimbol
      }]
    },
    port: {
      identifier: 'port',
      rules: [{
        type: 'integer[1..65535]',
        prompt: globalTranslate.pr_ValidationProviderPortRange
      }]
    }
  },
  initialize: function initialize() {
    provider.$checkBoxes.checkbox();
    provider.$accordions.accordion();
    provider.$dropDowns.dropdown();
    provider.$qualifyToggle.checkbox({
      onChange: function onChange() {
        if (provider.$qualifyToggle.checkbox('is checked')) {
          provider.$qualifyFreqToggle.removeClass('disabled');
        } else {
          provider.$qualifyFreqToggle.addClass('disabled');
        }
      }
    }); // Add new string to additional-hosts-table table

    provider.$additionalHostInput.keypress(function (e) {
      if (e.which === 13) {
        provider.cbOnCompleteHostAddress();
      }
    }); // Delete host from additional-hosts-table

    provider.$deleteRowButton.on('click', function (e) {
      $(e.target).closest('tr').remove();
      provider.updateHostsTableView();
      provider.$dirrtyField.val(Math.random());
      provider.$dirrtyField.trigger('change');
      e.preventDefault();
      return false;
    });
    provider.initializeForm();
    provider.updateVisibilityElements();
    $('#registration_type').on('change', provider.updateVisibilityElements);
    $('#disablefromuser input').on('change', provider.updateVisibilityElements);
    $('#generate-new-password').on('click', function (e) {
      e.preventDefault();
      var chars = 'abcdef1234567890';
      var pass = '';

      for (var x = 0; x < 32; x += 1) {
        var i = Math.floor(Math.random() * chars.length);
        pass += chars.charAt(i);
      }

      provider.$secret.val(pass);
      provider.$secret.trigger('change');
    });
    provider.$secret.on('change', function () {
      $('#elSecret a.ui.button.clipboard').attr('data-clipboard-text', provider.$secret.val());
    });
    var clipboard = new ClipboardJS('.clipboard');
    $('.clipboard').popup({
      on: 'manual'
    });
    clipboard.on('success', function (e) {
      $(e.trigger).popup('show');
      setTimeout(function () {
        $(e.trigger).popup('hide');
      }, 1500);
      e.clearSelection();
    });
    clipboard.on('error', function (e) {
      console.error('Action:', e.action);
      console.error('Trigger:', e.trigger);
    });
  },
  updateVisibilityElements: function updateVisibilityElements() {
    if (provider.providerType !== 'SIP') {
      return;
    }

    var elHost = $('#elHost');
    var elUsername = $('#elUsername');
    var elSecret = $('#elSecret');
    var elAdditionalHost = $('#elAdditionalHosts');
    var regType = $('#registration_type').val();
    var elUniqId = $('#uniqid');
    var genPassword = $('#generate-new-password');
    var valUserName = $('#username');
    var valSecret = provider.$secret;

    if (valUserName.val() === elUniqId.val() && regType !== 'outbound') {
      valUserName.val('');
    }

    valUserName.removeAttr('readonly');

    if (regType === 'outbound') {
      elHost.show();
      elUsername.show();
      elSecret.show();
      elAdditionalHost.show();
      genPassword.hide();
    } else if (regType === 'inbound') {
      valUserName.val(elUniqId.val());
      valUserName.attr('readonly', '');

      if (valSecret.val().trim() === '') {
        valSecret.val('id=' + $('#id').val() + '-' + elUniqId.val());
      }

      elHost.hide();
      elUsername.show();
      elSecret.show();
      genPassword.show();
    } else if (regType === 'none') {
      elHost.show();
      elUsername.hide();
      elSecret.hide();
    }

    var el = $('#disablefromuser');
    var fromUser = $('#divFromUser');

    if (el.checkbox('is checked')) {
      fromUser.hide();
      fromUser.removeClass('visible');
    } else {
      fromUser.show();
      fromUser.addClass('visible');
    }
  },

  /**
   * Adds record to hosts table
   */
  cbOnCompleteHostAddress: function cbOnCompleteHostAddress() {
    var value = provider.$formObj.form('get value', 'additional-host');

    if (value) {
      var validation = value.match(provider.hostInputValidation);

      if (validation === null || validation.length === 0) {
        provider.$additionalHostInput.transition('shake');
        return;
      }

      if ($(".host-row[data-value=\"".concat(value, "\"]")).length === 0) {
        var $tr = $('.host-row-tpl').last();
        var $clone = $tr.clone(true);
        $clone.removeClass('host-row-tpl').addClass('host-row').show();
        $clone.attr('data-value', value);
        $clone.find('.address').html(value);

        if ($(provider.hostRow).last().length === 0) {
          $tr.after($clone);
        } else {
          $(provider.hostRow).last().after($clone);
        }

        provider.updateHostsTableView();
        provider.$dirrtyField.val(Math.random());
        provider.$dirrtyField.trigger('change');
      }

      provider.$additionalHostInput.val('');
    }
  },

  /**
   * Shows dummy if we have zero rows
   */
  updateHostsTableView: function updateHostsTableView() {
    var dummy = "<tr class=\"dummy\"><td colspan=\"4\" class=\"center aligned\">".concat(globalTranslate.pr_NoAnyAdditionalHosts, "</td></tr>");

    if ($(provider.hostRow).length === 0) {
      $('#additional-hosts-table tbody').append(dummy);
    } else {
      $('#additional-hosts-table tbody .dummy').remove();
    }
  },
  cbBeforeSendForm: function cbBeforeSendForm(settings) {
    var result = settings;
    result.data = provider.$formObj.form('get values');
    var arrAdditionalHosts = [];
    $(provider.hostRow).each(function (index, obj) {
      if ($(obj).attr('data-value')) {
        arrAdditionalHosts.push({
          address: $(obj).attr('data-value')
        });
      }
    });
    result.data.additionalHosts = JSON.stringify(arrAdditionalHosts);
    return result;
  },
  cbAfterSendForm: function cbAfterSendForm() {},
  initializeForm: function initializeForm() {
    Form.$formObj = provider.$formObj;

    Form.$formObj.form.settings.rules.checkHostProvider = function (value) {
      var enable;

      if ($('#registration_type').val() === 'inbound') {
        enable = true;
      } else {
        enable = value.trim() !== '';
      }

      return enable;
    };

    switch (provider.providerType) {
      case 'SIP':
        Form.url = "".concat(globalRootUrl, "providers/save/sip");
        break;

      case 'IAX':
        Form.url = "".concat(globalRootUrl, "providers/save/iax");
        break;

      default:
        return;
    }

    Form.validateRules = provider.validateRules;
    Form.cbBeforeSendForm = provider.cbBeforeSendForm;
    Form.cbAfterSendForm = provider.cbAfterSendForm;
    Form.initialize();
  }
};
$(document).ready(function () {
  provider.initialize();
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Qcm92aWRlcnMvcHJvdmlkZXItbW9kaWZ5LmpzIl0sIm5hbWVzIjpbIiQiLCJmbiIsImZvcm0iLCJzZXR0aW5ncyIsInJ1bGVzIiwidXNlcm5hbWUiLCJub3JlZ2lzdGVyIiwibGVuZ3RoIiwicHJvdmlkZXIiLCIkZm9ybU9iaiIsIiRzZWNyZXQiLCIkZGlycnR5RmllbGQiLCJwcm92aWRlclR5cGUiLCJ2YWwiLCIkY2hlY2tCb3hlcyIsIiRhY2NvcmRpb25zIiwiJGRyb3BEb3ducyIsIiRkZWxldGVSb3dCdXR0b24iLCIkcXVhbGlmeVRvZ2dsZSIsIiRxdWFsaWZ5RnJlcVRvZ2dsZSIsIiRhZGRpdGlvbmFsSG9zdElucHV0IiwiaG9zdElucHV0VmFsaWRhdGlvbiIsImhvc3RSb3ciLCJ2YWxpZGF0ZVJ1bGVzIiwiZGVzY3JpcHRpb24iLCJpZGVudGlmaWVyIiwidHlwZSIsInByb21wdCIsImdsb2JhbFRyYW5zbGF0ZSIsInByX1ZhbGlkYXRpb25Qcm92aWRlck5hbWVJc0VtcHR5IiwiaG9zdCIsInByX1ZhbGlkYXRpb25Qcm92aWRlckhvc3RJc0VtcHR5Iiwib3B0aW9uYWwiLCJwcl9WYWxpZGF0aW9uUHJvdmlkZXJMb2dpbk5vdFNpbmdsZVNpbWJvbCIsInBvcnQiLCJwcl9WYWxpZGF0aW9uUHJvdmlkZXJQb3J0UmFuZ2UiLCJpbml0aWFsaXplIiwiY2hlY2tib3giLCJhY2NvcmRpb24iLCJkcm9wZG93biIsIm9uQ2hhbmdlIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsImtleXByZXNzIiwiZSIsIndoaWNoIiwiY2JPbkNvbXBsZXRlSG9zdEFkZHJlc3MiLCJvbiIsInRhcmdldCIsImNsb3Nlc3QiLCJyZW1vdmUiLCJ1cGRhdGVIb3N0c1RhYmxlVmlldyIsIk1hdGgiLCJyYW5kb20iLCJ0cmlnZ2VyIiwicHJldmVudERlZmF1bHQiLCJpbml0aWFsaXplRm9ybSIsInVwZGF0ZVZpc2liaWxpdHlFbGVtZW50cyIsImNoYXJzIiwicGFzcyIsIngiLCJpIiwiZmxvb3IiLCJjaGFyQXQiLCJhdHRyIiwiY2xpcGJvYXJkIiwiQ2xpcGJvYXJkSlMiLCJwb3B1cCIsInNldFRpbWVvdXQiLCJjbGVhclNlbGVjdGlvbiIsImNvbnNvbGUiLCJlcnJvciIsImFjdGlvbiIsImVsSG9zdCIsImVsVXNlcm5hbWUiLCJlbFNlY3JldCIsImVsQWRkaXRpb25hbEhvc3QiLCJyZWdUeXBlIiwiZWxVbmlxSWQiLCJnZW5QYXNzd29yZCIsInZhbFVzZXJOYW1lIiwidmFsU2VjcmV0IiwicmVtb3ZlQXR0ciIsInNob3ciLCJoaWRlIiwidHJpbSIsImVsIiwiZnJvbVVzZXIiLCJ2YWx1ZSIsInZhbGlkYXRpb24iLCJtYXRjaCIsInRyYW5zaXRpb24iLCIkdHIiLCJsYXN0IiwiJGNsb25lIiwiY2xvbmUiLCJmaW5kIiwiaHRtbCIsImFmdGVyIiwiZHVtbXkiLCJwcl9Ob0FueUFkZGl0aW9uYWxIb3N0cyIsImFwcGVuZCIsImNiQmVmb3JlU2VuZEZvcm0iLCJyZXN1bHQiLCJkYXRhIiwiYXJyQWRkaXRpb25hbEhvc3RzIiwiZWFjaCIsImluZGV4Iiwib2JqIiwicHVzaCIsImFkZHJlc3MiLCJhZGRpdGlvbmFsSG9zdHMiLCJKU09OIiwic3RyaW5naWZ5IiwiY2JBZnRlclNlbmRGb3JtIiwiRm9ybSIsImNoZWNrSG9zdFByb3ZpZGVyIiwiZW5hYmxlIiwidXJsIiwiZ2xvYmFsUm9vdFVybCIsImRvY3VtZW50IiwicmVhZHkiXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUVBO0FBQ0FBLENBQUMsQ0FBQ0MsRUFBRixDQUFLQyxJQUFMLENBQVVDLFFBQVYsQ0FBbUJDLEtBQW5CLENBQXlCQyxRQUF6QixHQUFvQyxVQUFVQyxVQUFWLEVBQXNCRCxRQUF0QixFQUFnQztBQUNuRSxTQUFPLEVBQUVBLFFBQVEsQ0FBQ0UsTUFB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LENBQUQsQ0FBd0JhLEdBQXhCLE9BQWtDLFNBQXJDLEVBQStDO0FBQzlDd0csUUFBQUEsTUFBTSxHQUFHLElBQVQ7QUFDQSxPQUZELE1BRUs7QUFDSkEsUUFBQUEsTUFBTSxHQUFHN0IsS0FBSyxDQUFDSCxJQUFOLE9BQWlCLEVBQTFCO0FBQ0E7O0FBQ0QsYUFBT2dDLE1BQVA7QUFDQSxLQVJEOztBQVNBLFlBQVE3RyxRQUFRLENBQUNJLFlBQWpCO0FBQ0MsV0FBSyxLQUFMO0FBQ0N1RyxRQUFBQSxJQUFJLENBQUNHLEdBQUwsYUFBY0MsYUFBZDtBQUNBOztBQUNELFdBQUssS0FBTDtBQUNDSixRQUFBQSxJQUFJLENBQUNHLEdBQUwsYUFBY0MsYUFBZDtBQUNBOztBQUNEO0FBQ0M7QUFSRjs7QUFVQUosSUFBQUEsSUFBSSxDQUFDNUYsYUFBTCxHQUFxQmYsUUFBUSxDQUFDZSxhQUE5QjtBQUNBNEYsSUFBQUEsSUFBSSxDQUFDYixnQkFBTCxHQUF3QjlGLFFBQVEsQ0FBQzhGLGdCQUFqQztBQUNBYSxJQUFBQSxJQUFJLENBQUNELGVBQUwsR0FBdUIxRyxRQUFRLENBQUMwRyxlQUFoQztBQUNBQyxJQUFBQSxJQUFJLENBQUMvRSxVQUFMO0FBQ0E7QUFuUWUsQ0FBakI7QUF3UUFwQyxDQUFDLENBQUN3SCxRQUFELENBQUQsQ0FBWUMsS0FBWixDQUFrQixZQUFNO0FBQ3ZCakgsRUFBQUEsUUFBUSxDQUFDNEIsVUFBVDtBQUNBLENBRkQiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogTWlrb1BCWCAtIGZyZWUgcGhvbmUgc3lzdGVtIGZvciBzbWFsbCBidXNpbmVzc1xuICogQ29weXJpZ2h0IChDKSAyMDE3LTIwMjAgQWxleGV5IFBvcnRub3YgYW5kIE5pa29sYXkgQmVrZXRvdlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG4gKiBpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuICogdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbjsgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3JcbiAqIChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG4gKiBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuICogTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuICogR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwczovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cblxuLyogZ2xvYmFsIGdsb2JhbFJvb3RVcmwsIGdsb2JhbFRyYW5zbGF0ZSwgRm9ybSwgJCwgQ2xpcGJvYXJkSlMgKi9cblxuLy8gY3VzdG9tIGZvcm0gdmFsaWRhdGlvbiBydWxlXG4kLmZuLmZvcm0uc2V0dGluZ3MucnVsZXMudXNlcm5hbWUgPSBmdW5jdGlvbiAobm9yZWdpc3RlciwgdXNlcm5hbWUpIHtcblx0cmV0dXJuICEodXNlcm5hbWUubGVuZ3RoID09PSAwICYmIG5vcmVnaXN0ZXIgIT09ICdvbicpO1xufTtcblxuY29uc3QgcHJvdmlkZXIgPSB7XG5cdCRmb3JtT2JqOiAkKCcjc2F2ZS1wcm92aWRlci1mb3JtJyksXG5cdCRzZWNyZXQ6ICQoJyNzZWNyZXQnKSxcblx0JGRpcnJ0eUZpZWxkOiAkKCcjZGlycnR5JyksXG5cdHByb3ZpZGVyVHlwZTogJCgnI3Byb3ZpZGVyVHlwZScpLnZhbCgpLFxuXHQkY2hlY2tCb3hlczogJCgnI3NhdmUtcHJvdmlkZXItZm9ybSAuY2hlY2tib3gnKSxcblx0JGFjY29yZGlvbnM6ICQoJyNzYXZlLXByb3ZpZGVyLWZvcm0gLnVpLmFjY29yZGlvbicpLFxuXHQkZHJvcERvd25zOiAkKCcjc2F2ZS1wcm92aWRlci1mb3JtIC51aS5kcm9wZG93bicpLFxuXHQkZGVsZXRlUm93QnV0dG9uOiAkKCcjYWRkaXRpb25hbC1ob3N0cy10YWJsZSAuZGVsZXRlLXJvdy1idXR0b24nKSxcblx0JHF1YWxpZnlUb2dnbGU6ICQoJyNxdWFsaWZ5JyksXG5cdCRxdWFsaWZ5RnJlcVRvZ2dsZTogJCgnI3F1YWxpZnktZnJlcScpLFxuXHQkYWRkaXRpb25hbEhvc3RJbnB1dDogJCgnI2FkZGl0aW9uYWwtaG9zdCBpbnB1dCcpLFxuXHRob3N0SW5wdXRWYWxpZGF0aW9uOiAvXigoKFswLTldfFsxLTldWzAtOV18MVswLTldezJ9fDJbMC00XVswLTldfDI1WzAtNV0pXFwuKXszfShbMC05XXxbMS05XVswLTldfDFbMC05XXsyfXwyWzAtNF1bMC05XXwyNVswLTVdKShcXC8oXFxkfFsxLTJdXFxkfDNbMC0yXSkpP3xbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSg/OlxcLlthLXpBLVpdezIsfSkrKSQvZ20sXG5cdGhvc3RSb3c6ICcjc2F2ZS1wcm92aWRlci1mb3JtIC5ob3N0LXJvdycsXG5cdHZhbGlkYXRlUnVsZXM6IHtcblx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0aWRlbnRpZmllcjogJ2Rlc2NyaXB0aW9uJyxcblx0XHRcdHJ1bGVzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnZW1wdHknLFxuXHRcdFx0XHRcdHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLnByX1ZhbGlkYXRpb25Qcm92aWRlck5hbWVJc0VtcHR5LFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHR9LFxuXHRcdGhvc3Q6IHtcblx0XHRcdGlkZW50aWZpZXI6ICdob3N0Jyxcblx0XHRcdHJ1bGVzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnY2hlY2tIb3N0UHJvdmlkZXInLFxuXHRcdFx0XHRcdHByb21wdDogZ2xvYmFsVHJhbnNsYXRlLnByX1ZhbGlkYXRpb25Qcm92aWRlckhvc3RJc0VtcHR5LFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHR9LFxuXHRcdHVzZXJuYW1lOiB7XG5cdFx0XHRpZGVudGlmaWVyOiAndXNlcm5hbWUnLFxuXHRcdFx0b3B0aW9uYWwgICA6IHRydWUsXG5cdFx0XHRydWxlczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ21pbkxlbmd0aFsyXScsXG5cdFx0XHRcdFx0cHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUucHJfVmFsaWRhdGlvblByb3ZpZGVyTG9naW5Ob3RTaW5nbGVTaW1ib2wsXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0sXG5cdFx0cG9ydDoge1xuXHRcdFx0aWRlbnRpZmllcjogJ3BvcnQnLFxuXHRcdFx0cnVsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdpbnRlZ2VyWzEuLjY1NTM1XScsXG5cdFx0XHRcdFx0cHJvbXB0OiBnbG9iYWxUcmFuc2xhdGUucHJfVmFsaWRhdGlvblByb3ZpZGVyUG9ydFJhbmdlLFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHR9LFxuXHR9LFxuXHRpbml0aWFsaXplKCkge1xuXHRcdHByb3ZpZGVyLiRjaGVja0JveGVzLmNoZWNrYm94KCk7XG5cdFx0cHJvdmlkZXIuJGFjY29yZGlvbnMuYWNjb3JkaW9uKCk7XG5cdFx0cHJvdmlkZXIuJGRyb3BEb3ducy5kcm9wZG93bigpO1xuXHRcdHByb3ZpZGVyLiRxdWFsaWZ5VG9nZ2xlLmNoZWNrYm94KHtcblx0XHRcdG9uQ2hhbmdlKCkge1xuXHRcdFx0XHRpZiAocHJvdmlkZXIuJHF1YWxpZnlUb2dnbGUuY2hlY2tib3goJ2lzIGNoZWNrZWQnKSkge1xuXHRcdFx0XHRcdHByb3ZpZGVyLiRxdWFsaWZ5RnJlcVRvZ2dsZS5yZW1vdmVDbGFzcygnZGlzYWJsZWQnKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm92aWRlci4kcXVhbGlmeUZyZXFUb2dnbGUuYWRkQ2xhc3MoJ2Rpc2FibGVkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0Ly8gQWRkIG5ldyBzdHJpbmcgdG8gYWRkaXRpb25hbC1ob3N0cy10YWJsZSB0YWJsZVxuXHRcdHByb3ZpZGVyLiRhZGRpdGlvbmFsSG9zdElucHV0LmtleXByZXNzKChlKT0+e1xuXHRcdFx0aWYgKGUud2hpY2ggPT09IDEzKSB7XG5cdFx0XHRcdHByb3ZpZGVyLmNiT25Db21wbGV0ZUhvc3RBZGRyZXNzKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Ly8gRGVsZXRlIGhvc3QgZnJvbSBhZGRpdGlvbmFsLWhvc3RzLXRhYmxlXG5cdFx0cHJvdmlkZXIuJGRlbGV0ZVJvd0J1dHRvbi5vbignY2xpY2snLCAoZSkgPT4ge1xuXHRcdFx0JChlLnRhcmdldCkuY2xvc2VzdCgndHInKS5yZW1vdmUoKTtcblx0XHRcdHByb3ZpZGVyLnVwZGF0ZUhvc3RzVGFibGVWaWV3KCk7XG5cdFx0XHRwcm92aWRlci4kZGlycnR5RmllbGQudmFsKE1hdGgucmFuZG9tKCkpO1xuXHRcdFx0cHJvdmlkZXIuJGRpcnJ0eUZpZWxkLnRyaWdnZXIoJ2NoYW5nZScpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pO1xuXHRcdHByb3ZpZGVyLmluaXRpYWxpemVGb3JtKCk7XG5cblx0XHRwcm92aWRlci51cGRhdGVWaXNpYmlsaXR5RWxlbWVudHMoKTtcblx0XHQkKCcjcmVnaXN0cmF0aW9uX3R5cGUnKS5vbignY2hhbmdlJywgcHJvdmlkZXIudXBkYXRlVmlzaWJpbGl0eUVsZW1lbnRzKTtcblx0XHQkKCcjZGlzYWJsZWZyb211c2VyIGlucHV0Jykub24oJ2NoYW5nZScsIHByb3ZpZGVyLnVwZGF0ZVZpc2liaWxpdHlFbGVtZW50cyk7XG5cblx0XHQkKCcjZ2VuZXJhdGUtbmV3LXBhc3N3b3JkJykub24oJ2NsaWNrJywgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvbnN0IGNoYXJzID0gJ2FiY2RlZjEyMzQ1Njc4OTAnO1xuXHRcdFx0bGV0IHBhc3MgPSAnJztcblx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgMzI7IHggKz0gMSkge1xuXHRcdFx0XHRjb25zdCBpID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcnMubGVuZ3RoKTtcblx0XHRcdFx0cGFzcyArPSBjaGFycy5jaGFyQXQoaSk7XG5cdFx0XHR9XG5cdFx0XHRwcm92aWRlci4kc2VjcmV0LnZhbChwYXNzKTtcblx0XHRcdHByb3ZpZGVyLiRzZWNyZXQudHJpZ2dlcignY2hhbmdlJyk7XG5cdFx0fSk7XG5cdFx0cHJvdmlkZXIuJHNlY3JldC5vbignY2hhbmdlJywgKCkgPT4ge1xuXHRcdFx0JCgnI2VsU2VjcmV0IGEudWkuYnV0dG9uLmNsaXBib2FyZCcpLmF0dHIoJ2RhdGEtY2xpcGJvYXJkLXRleHQnLCBwcm92aWRlci4kc2VjcmV0LnZhbCgpKVxuXHRcdH0pO1xuXHRcdGNvbnN0IGNsaXBib2FyZCA9IG5ldyBDbGlwYm9hcmRKUygnLmNsaXBib2FyZCcpO1xuXHRcdCQoJy5jbGlwYm9hcmQnKS5wb3B1cCh7XG5cdFx0XHRvbjogJ21hbnVhbCcsXG5cdFx0fSk7XG5cdFx0Y2xpcGJvYXJkLm9uKCdzdWNjZXNzJywgKGUpID0+IHtcblx0XHRcdCQoZS50cmlnZ2VyKS5wb3B1cCgnc2hvdycpO1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdCQoZS50cmlnZ2VyKS5wb3B1cCgnaGlkZScpO1xuXHRcdFx0fSwgMTUwMCk7XG5cdFx0XHRlLmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0fSk7XG5cblx0XHRjbGlwYm9hcmQub24oJ2Vycm9yJywgKGUpID0+IHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0FjdGlvbjonLCBlLmFjdGlvbik7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdUcmlnZ2VyOicsIGUudHJpZ2dlcik7XG5cdFx0fSk7XG5cdH0sXG5cdHVwZGF0ZVZpc2liaWxpdHlFbGVtZW50cygpe1xuXHRcdGlmKHByb3ZpZGVyLnByb3ZpZGVyVHlwZSAhPT0gJ1NJUCcpe1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgZWxIb3N0IFx0ICAgIFx0PSAkKCcjZWxIb3N0Jyk7XG5cdFx0bGV0IGVsVXNlcm5hbWUgIFx0PSAkKCcjZWxVc2VybmFtZScpO1xuXHRcdGxldCBlbFNlY3JldCAgICBcdD0gJCgnI2VsU2VjcmV0Jyk7XG5cdFx0bGV0IGVsQWRkaXRpb25hbEhvc3Q9ICQoJyNlbEFkZGl0aW9uYWxIb3N0cycpO1xuXHRcdGxldCByZWdUeXBlIFx0XHQ9ICQoJyNyZWdpc3RyYXRpb25fdHlwZScpLnZhbCgpO1xuXHRcdGxldCBlbFVuaXFJZFx0XHQ9ICQoJyN1bmlxaWQnKTtcblx0XHRsZXQgZ2VuUGFzc3dvcmRcdFx0PSAkKCcjZ2VuZXJhdGUtbmV3LXBhc3N3b3JkJyk7XG5cblx0XHRsZXQgdmFsVXNlck5hbWUgIFx0PSAkKCcjdXNlcm5hbWUnKTtcblx0XHRsZXQgdmFsU2VjcmV0ICAgXHQ9IHByb3ZpZGVyLiRzZWNyZXQ7XG5cblx0XHRpZih2YWxVc2VyTmFtZS52YWwoKSA9PT0gZWxVbmlxSWQudmFsKCkgJiYgcmVnVHlwZSAhPT0gJ291dGJvdW5kJyl7XG5cdFx0XHR2YWxVc2VyTmFtZS52YWwoJycpO1xuXHRcdH1cblx0XHR2YWxVc2VyTmFtZS5yZW1vdmVBdHRyKCdyZWFkb25seScpO1xuXHRcdGlmKHJlZ1R5cGUgPT09ICdvdXRib3VuZCcpe1xuXHRcdFx0ZWxIb3N0LnNob3coKTtcblx0XHRcdGVsVXNlcm5hbWUuc2hvdygpO1xuXHRcdFx0ZWxTZWNyZXQuc2hvdygpO1xuXHRcdFx0ZWxBZGRpdGlvbmFsSG9zdC5zaG93KCk7XG5cdFx0XHRnZW5QYXNzd29yZC5oaWRlKCk7XG5cdFx0fWVsc2UgaWYocmVnVHlwZSA9PT0gJ2luYm91bmQnKXtcblx0XHRcdHZhbFVzZXJOYW1lLnZhbChlbFVuaXFJZC52YWwoKSk7XG5cdFx0XHR2YWxVc2VyTmFtZS5hdHRyKCdyZWFkb25seScsICcnKTtcblx0XHRcdGlmKHZhbFNlY3JldC52YWwoKS50cmltKCkgPT09ICcnKXtcblx0XHRcdFx0dmFsU2VjcmV0LnZhbCgnaWQ9JyskKCcjaWQnKS52YWwoKSsnLScrZWxVbmlxSWQudmFsKCkpXG5cdFx0XHR9XG5cdFx0XHRlbEhvc3QuaGlkZSgpO1xuXHRcdFx0ZWxVc2VybmFtZS5zaG93KCk7XG5cdFx0XHRlbFNlY3JldC5zaG93KCk7XG5cdFx0XHRnZW5QYXNzd29yZC5zaG93KCk7XG5cdFx0fWVsc2UgaWYocmVnVHlwZSA9PT0gJ25vbmUnKXtcblx0XHRcdGVsSG9zdC5zaG93KCk7XG5cdFx0XHRlbFVzZXJuYW1lLmhpZGUoKTtcblx0XHRcdGVsU2VjcmV0LmhpZGUoKTtcblx0XHR9XG5cblx0XHRsZXQgZWwgPSAkKCcjZGlzYWJsZWZyb211c2VyJyk7XG5cdFx0bGV0IGZyb21Vc2VyID0gJCgnI2RpdkZyb21Vc2VyJyk7XG5cdFx0aWYoZWwuY2hlY2tib3goJ2lzIGNoZWNrZWQnKSl7XG5cdFx0XHRmcm9tVXNlci5oaWRlKCk7XG5cdFx0XHRmcm9tVXNlci5yZW1vdmVDbGFzcygndmlzaWJsZScpO1xuXHRcdH1lbHNle1xuXHRcdFx0ZnJvbVVzZXIuc2hvdygpO1xuXHRcdFx0ZnJvbVVzZXIuYWRkQ2xhc3MoJ3Zpc2libGUnKTtcblxuXHRcdH1cblx0fSxcblx0LyoqXG5cdCAqIEFkZHMgcmVjb3JkIHRvIGhvc3RzIHRhYmxlXG5cdCAqL1xuXHRjYk9uQ29tcGxldGVIb3N0QWRkcmVzcygpe1xuXHRcdGNvbnN0IHZhbHVlID0gcHJvdmlkZXIuJGZvcm1PYmouZm9ybSgnZ2V0IHZhbHVlJywgJ2FkZGl0aW9uYWwtaG9zdCcpO1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0Y29uc3QgdmFsaWRhdGlvbiA9IHZhbHVlLm1hdGNoKHByb3ZpZGVyLmhvc3RJbnB1dFZhbGlkYXRpb24pO1xuXHRcdFx0aWYgKHZhbGlkYXRpb249PT1udWxsXG5cdFx0XHRcdHx8IHZhbGlkYXRpb24ubGVuZ3RoPT09MCl7XG5cdFx0XHRcdHByb3ZpZGVyLiRhZGRpdGlvbmFsSG9zdElucHV0LnRyYW5zaXRpb24oJ3NoYWtlJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCQoYC5ob3N0LXJvd1tkYXRhLXZhbHVlPVwiJHt2YWx1ZX1cIl1gKS5sZW5ndGg9PT0wKXtcblx0XHRcdFx0Y29uc3QgJHRyID0gJCgnLmhvc3Qtcm93LXRwbCcpLmxhc3QoKTtcblx0XHRcdFx0Y29uc3QgJGNsb25lID0gJHRyLmNsb25lKHRydWUpO1xuXHRcdFx0XHQkY2xvbmVcblx0XHRcdFx0XHQucmVtb3ZlQ2xhc3MoJ2hvc3Qtcm93LXRwbCcpXG5cdFx0XHRcdFx0LmFkZENsYXNzKCdob3N0LXJvdycpXG5cdFx0XHRcdFx0LnNob3coKTtcblx0XHRcdFx0JGNsb25lLmF0dHIoJ2RhdGEtdmFsdWUnLCB2YWx1ZSk7XG5cdFx0XHRcdCRjbG9uZS5maW5kKCcuYWRkcmVzcycpLmh0bWwodmFsdWUpO1xuXHRcdFx0XHRpZiAoJChwcm92aWRlci5ob3N0Um93KS5sYXN0KCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0JHRyLmFmdGVyKCRjbG9uZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JChwcm92aWRlci5ob3N0Um93KS5sYXN0KCkuYWZ0ZXIoJGNsb25lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm92aWRlci51cGRhdGVIb3N0c1RhYmxlVmlldygpO1xuXHRcdFx0XHRwcm92aWRlci4kZGlycnR5RmllbGQudmFsKE1hdGgucmFuZG9tKCkpO1xuXHRcdFx0XHRwcm92aWRlci4kZGlycnR5RmllbGQudHJpZ2dlcignY2hhbmdlJyk7XG5cdFx0XHR9XG5cdFx0XHRwcm92aWRlci4kYWRkaXRpb25hbEhvc3RJbnB1dC52YWwoJycpO1xuXHRcdH1cblx0fSxcblx0LyoqXG5cdCAqIFNob3dzIGR1bW15IGlmIHdlIGhhdmUgemVybyByb3dzXG5cdCAqL1xuXHR1cGRhdGVIb3N0c1RhYmxlVmlldygpIHtcblx0XHRjb25zdCBkdW1teSA9IGA8dHIgY2xhc3M9XCJkdW1teVwiPjx0ZCBjb2xzcGFuPVwiNFwiIGNsYXNzPVwiY2VudGVyIGFsaWduZWRcIj4ke2dsb2JhbFRyYW5zbGF0ZS5wcl9Ob0FueUFkZGl0aW9uYWxIb3N0c308L3RkPjwvdHI+YDtcblxuXHRcdGlmICgkKHByb3ZpZGVyLmhvc3RSb3cpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0JCgnI2FkZGl0aW9uYWwtaG9zdHMtdGFibGUgdGJvZHknKS5hcHBlbmQoZHVtbXkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQkKCcjYWRkaXRpb25hbC1ob3N0cy10YWJsZSB0Ym9keSAuZHVtbXknKS5yZW1vdmUoKTtcblx0XHR9XG5cdH0sXG5cdGNiQmVmb3JlU2VuZEZvcm0oc2V0dGluZ3MpIHtcblx0XHRjb25zdCByZXN1bHQgPSBzZXR0aW5ncztcblx0XHRyZXN1bHQuZGF0YSA9IHByb3ZpZGVyLiRmb3JtT2JqLmZvcm0oJ2dldCB2YWx1ZXMnKTtcblxuXHRcdGNvbnN0IGFyckFkZGl0aW9uYWxIb3N0cyA9IFtdO1xuXHRcdCQocHJvdmlkZXIuaG9zdFJvdykuZWFjaCgoaW5kZXgsIG9iaikgPT4ge1xuXHRcdFx0aWYgKCQob2JqKS5hdHRyKCdkYXRhLXZhbHVlJykpIHtcblx0XHRcdFx0YXJyQWRkaXRpb25hbEhvc3RzLnB1c2goe1xuXHRcdFx0XHRcdGFkZHJlc3M6ICQob2JqKS5hdHRyKCdkYXRhLXZhbHVlJyksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJlc3VsdC5kYXRhLmFkZGl0aW9uYWxIb3N0cyA9IEpTT04uc3RyaW5naWZ5KGFyckFkZGl0aW9uYWxIb3N0cyk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSxcblx0Y2JBZnRlclNlbmRGb3JtKCkge1xuXG5cdH0sXG5cdGluaXRpYWxpemVGb3JtKCkge1xuXHRcdEZvcm0uJGZvcm1PYmogPSBwcm92aWRlci4kZm9ybU9iajtcblx0XHRGb3JtLiRmb3JtT2JqLmZvcm0uc2V0dGluZ3MucnVsZXMuY2hlY2tIb3N0UHJvdmlkZXIgPSAodmFsdWUpID0+IHtcblx0XHRcdGxldCBlbmFibGU7XG5cdFx0XHRpZigkKCcjcmVnaXN0cmF0aW9uX3R5cGUnKS52YWwoKSA9PT0gJ2luYm91bmQnKXtcblx0XHRcdFx0ZW5hYmxlID0gdHJ1ZTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRlbmFibGUgPSB2YWx1ZS50cmltKCkgIT09ICcnO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVuYWJsZTtcblx0XHR9O1xuXHRcdHN3aXRjaCAocHJvdmlkZXIucHJvdmlkZXJUeXBlKSB7XG5cdFx0XHRjYXNlICdTSVAnOlxuXHRcdFx0XHRGb3JtLnVybCA9IGAke2dsb2JhbFJvb3RVcmx9cHJvdmlkZXJzL3NhdmUvc2lwYDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdJQVgnOlxuXHRcdFx0XHRGb3JtLnVybCA9IGAke2dsb2JhbFJvb3RVcmx9cHJvdmlkZXJzL3NhdmUvaWF4YDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdEZvcm0udmFsaWRhdGVSdWxlcyA9IHByb3ZpZGVyLnZhbGlkYXRlUnVsZXM7XG5cdFx0Rm9ybS5jYkJlZm9yZVNlbmRGb3JtID0gcHJvdmlkZXIuY2JCZWZvcmVTZW5kRm9ybTtcblx0XHRGb3JtLmNiQWZ0ZXJTZW5kRm9ybSA9IHByb3ZpZGVyLmNiQWZ0ZXJTZW5kRm9ybTtcblx0XHRGb3JtLmluaXRpYWxpemUoKTtcblx0fSxcbn07XG5cblxuXG4kKGRvY3VtZW50KS5yZWFkeSgoKSA9PiB7XG5cdHByb3ZpZGVyLmluaXRpYWxpemUoKTtcbn0pO1xuIl19