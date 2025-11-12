import { override } from 'flarum/common/extend';
import ForgotPasswordModal from 'flarum/forum/components/ForgotPasswordModal';
import LogInModal from 'flarum/forum/components/LogInModal';
import SignUpModal from 'flarum/forum/components/SignUpModal';
import ChangePasswordModal from 'flarum/forum/components/ChangePasswordModal';

import TurnstileState from '../common/states/TurnstileState';
import Turnstile from './components/Turnstile';

const addTurnstileToAuthModal = <T extends typeof ForgotPasswordModal | typeof LogInModal | typeof SignUpModal | typeof ChangePasswordModal>({
  modal,
  type,
  dataMethod,
}: {
  modal: T;
  type: 'forgot' | 'signin' | 'signup';
  dataMethod: 'requestParams' | 'loginParams' | 'submitData' | 'requestBody';
}) => {
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

    fields.add('turnstile', <Turnstile state={this.turnstile} />, this instanceof ChangePasswordModal ? 10 : -5);

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
};

export default function extendAuthModalsWithTurnstile() {
  addTurnstileToAuthModal({
    modal: ForgotPasswordModal,
    type: 'forgot',
    dataMethod: 'requestParams',
  });

  addTurnstileToAuthModal({
    modal: LogInModal,
    type: 'signin',
    dataMethod: 'loginParams',
  });

  addTurnstileToAuthModal({
    modal: SignUpModal,
    type: 'signup',
    dataMethod: 'submitData',
  });

  addTurnstileToAuthModal({
    modal: ChangePasswordModal,
    type: 'forgot',
    dataMethod: 'requestBody',
  });
}
