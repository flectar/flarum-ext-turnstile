import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import TurnstileState from '../common/states/TurnstileState';
import Turnstile from './components/Turnstile';

export default function extendAuthModalsWithTurnstile() {
  const isEnabled = (type: 'forgot' | 'signin' | 'signup') => !!app.forum.attribute(`flectar-turnstile.${type}`);

  const applyExtenders = (
    modulePath: string,
    type: 'forgot' | 'signin' | 'signup',
    dataMethod: 'requestParams' | 'loginParams' | 'submitData' | 'requestBody'
  ) => {
    extend(modulePath, 'oninit', function () {
      if (!isEnabled(type)) return;

      this.turnstile = new TurnstileState(
        () => {},
        (alertAttrs) => {
          this.loaded?.();
          this.alertAttrs = alertAttrs;
        }
      );
    });

    extend(modulePath, dataMethod, function (data) {
      if (!isEnabled(type)) return;

      data.turnstileToken = this.turnstile.getResponse();
    });

    extend(modulePath, 'fields', function (items) {
      if (!isEnabled(type)) return;

      const priority = modulePath.includes('ChangePasswordModal') ? 10 : -5;
      items.add('turnstile', <Turnstile state={this.turnstile} />, priority);
    });

    extend(modulePath, 'onerror', function (error) {
      if (!isEnabled(type)) return;

      this.turnstile.reset();
      if (error.alert && !error.alert.content?.length) {
        error.alert.content = app.translator.trans('flectar-turnstile.forum.validation_error');
      }
    });
  };

  applyExtenders('flarum/forum/components/ForgotPasswordModal', 'forgot', 'requestParams');
  applyExtenders('flarum/forum/components/LogInModal', 'signin', 'loginParams');
  applyExtenders('flarum/forum/components/SignUpModal', 'signup', 'submitData');
  applyExtenders('flarum/forum/components/ChangePasswordModal', 'forgot', 'requestBody');
}