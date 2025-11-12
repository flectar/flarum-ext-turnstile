import { override } from 'flarum/common/extend';
import TurnstileState from '../common/states/TurnstileState';
import Turnstile from './components/Turnstile';

export default function extendAuthModalsWithTurnstile() {
  const isEnabled = (type: 'forgot' | 'signin' | 'signup') => !!flarum.forum.attribute(`flectar-turnstile.${type}`);

  const applyOverrides = (
    modulePath: string,
    type: 'forgot' | 'signin' | 'signup',
    dataMethod: 'requestParams' | 'loginParams' | 'submitData' | 'requestBody'
  ) => {
    override(modulePath, 'oninit', function (original) {
      original();
      if (!isEnabled(type)) return;

      this.turnstile = new TurnstileState(
        () => {},
        (alertAttrs) => {
          this.loaded?.();
          this.alertAttrs = alertAttrs;
        }
      );
    });

    override(modulePath, dataMethod, function (original) {
      const data = original();
      if (!isEnabled(type)) return data;

      data.turnstileToken = this.turnstile.getResponse();
      return data;
    });

    override(modulePath, 'fields', function (original) {
      const fields = original();
      if (!isEnabled(type)) return fields;

      const priority = modulePath.includes('ChangePasswordModal') ? 10 : -5;
      fields.add('turnstile', <Turnstile state={this.turnstile} />, priority);

      return fields;
    });

    override(modulePath, 'onerror', function (original, error) {
      original(error);
      if (!isEnabled(type)) return;

      this.turnstile.reset();
      if (error.alert && !error.alert.content?.length) {
        error.alert.content = flarum.translator.trans('flectar-turnstile.forum.validation_error');
      }
      this.alertAttrs = error.alert;
      this.onready?.();
    });
  };

  applyOverrides('flarum/forum/components/ForgotPasswordModal', 'forgot', 'requestParams');
  applyOverrides('flarum/forum/components/LogInModal', 'signin', 'loginParams');
  applyOverrides('flarum/forum/components/SignUpModal', 'signup', 'submitData');
  applyOverrides('flarum/forum/components/ChangePasswordModal', 'forgot', 'requestBody');
}