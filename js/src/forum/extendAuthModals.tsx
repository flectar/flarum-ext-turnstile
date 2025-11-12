import { override } from 'flarum/common/extend';
import TurnstileState from '../common/states/TurnstileState';
import Turnstile from './components/Turnstile';

const addTurnstileToAuthModal = ({
  modulePath,
  type,
  dataMethod,
}: {
  modulePath: string;
  type: 'forgot' | 'signin' | 'signup';
  dataMethod: 'requestParams' | 'loginParams' | 'submitData' | 'requestBody';
}) => {
  import(modulePath).then((module) => {
    const modal = module.default;

    const isEnabled = () => !!flarum.forum.attribute(`flectar-turnstile.${type}`);

    override(modal.prototype, 'oninit', function (original) {
      original();

      if (!isEnabled()) return;

      this.turnstile = new TurnstileState(
        () => {},
        (alertAttrs) => {
          this.loaded?.();
          this.alertAttrs = alertAttrs;
        }
      );
    });

    override(modal.prototype, dataMethod, function (original) {
      const data = original();

      if (!isEnabled()) return data;

      data.turnstileToken = this.turnstile.getResponse();

      return data;
    });

    override(modal.prototype, 'fields', function (original) {
      const fields = original();

      if (!isEnabled()) return fields;
      const priority = modulePath.includes('ChangePasswordModal') ? 10 : -5;

      fields.add('turnstile', <Turnstile state={this.turnstile} />, priority);

      return fields;
    });

    override(modal.prototype, 'onerror', function (original, error) {
      original(error);

      if (!isEnabled()) return;

      this.turnstile.reset();

      if (error.alert && (!error.alert.content || !error.alert.content.length)) {
        error.alert.content = flarum.translator.trans('flectar-turnstile.forum.validation_error');
      }
      this.alertAttrs = error.alert;
      this.onready?.();
    });
  });
};

export default function extendAuthModalsWithTurnstile() {
  addTurnstileToAuthModal({
    modulePath: 'flarum/forum/components/ForgotPasswordModal',
    type: 'forgot',
    dataMethod: 'requestParams',
  });
  addTurnstileToAuthModal({
    modulePath: 'flarum/forum/components/LogInModal',
    type: 'signin',
    dataMethod: 'loginParams',
  });
  addTurnstileToAuthModal({
    modulePath: 'flarum/forum/components/SignUpModal',
    type: 'signup',
    dataMethod: 'submitData',
  });
  addTurnstileToAuthModal({
    modulePath: 'flarum/forum/components/ChangePasswordModal',
    type: 'forgot',
    dataMethod: 'requestBody',
  });
}
