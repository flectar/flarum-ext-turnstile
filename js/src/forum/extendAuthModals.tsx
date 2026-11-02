import { extend, override } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import type ItemList from 'flarum/common/utils/ItemList';
import type RequestError from 'flarum/common/utils/RequestError';
import type Mithril from 'mithril';
import TurnstileState from '../common/states/TurnstileState';
import Turnstile from './components/Turnstile';

// Show a held submission on core's submit button without disabling it, so it keeps focus and Enter still works.
function showSubmitWaiting(items: ItemList<Mithril.Children>) {
  const group = items.has('submit') ? (items.get('submit') as Mithril.Vnode) : null;
  const children = Array.isArray(group?.children) ? (group.children as Mithril.Vnode<Record<string, unknown>>[]) : [];
  const button = children.find((child) => child?.attrs?.type === 'submit');

  if (button) Object.assign(button.attrs, { loading: true, 'aria-disabled': 'true' });
}

export default function extendAuthModalsWithTurnstile() {
  const isEnabled = (type: 'forgot' | 'signin' | 'signup') => !!app.forum.attribute(`flectar-turnstile.${type}`);

  const applyExtenders = (
    modulePath: string,
    type: 'forgot' | 'signin' | 'signup',
    dataMethod: 'requestParams' | 'loginParams' | 'submitData' | 'requestBody'
  ) => {
    extend(modulePath, 'oninit', function () {
      if (!isEnabled(type)) return;

      let turnstileAlert: { type: 'error'; content: unknown } | null = null;

      this.turnstile = new TurnstileState(
        () => {
          if (turnstileAlert && this.alertAttrs === turnstileAlert) {
            this.alertAttrs = null;
            m.redraw();
          }
          turnstileAlert = null;
        },
        (alertAttrs) => {
          // Widget failures must not finish pending requests or reset the challenge.
          this.alertAttrs = turnstileAlert = alertAttrs;
          m.redraw();
        }
      );
    });

    override(modulePath, 'onsubmit', function (original, e) {
      if (!isEnabled(type)) return original(e);

      (e as SubmitEvent).preventDefault();
      this.turnstile.submitWhenReady(() => {
        original(e);
        m.redraw();
      });
    });

    extend(modulePath, dataMethod, function (data) {
      if (!isEnabled(type)) return;

      data.turnstileToken = this.turnstile.getResponse();
    });

    extend(modulePath, 'fields', function (items) {
      if (!isEnabled(type)) return;

      const priority = modulePath.includes('ChangePasswordModal') ? 10 : -5;
      items.add('turnstile', <Turnstile state={this.turnstile} />, priority);

      if (this.turnstile.isWaiting()) showSubmitWaiting(items);
    });

    extend(modulePath, 'onerror', function (_, error) {
      if (!isEnabled(type)) return;

      const requestError = error as RequestError;

      // Only a request that carried a token used it up.
      if (this.turnstile.getResponse()) this.turnstile.reset();
      if (requestError.alert && !requestError.alert.content?.length) {
        requestError.alert.content = app.translator.trans('flectar-turnstile.forum.validation_error');
      }
    });
  };

  applyExtenders('flarum/forum/components/ForgotPasswordModal', 'forgot', 'requestParams');
  applyExtenders('flarum/forum/components/LogInModal', 'signin', 'loginParams');
  applyExtenders('flarum/forum/components/SignUpModal', 'signup', 'submitData');
  applyExtenders('flarum/forum/components/ChangePasswordModal', 'forgot', 'requestBody');

  extend('flarum/forum/components/ChangePasswordModal', 'loaded', function () {
    if (isEnabled('forgot') && this.turnstile.getResponse()) this.turnstile.reset();
  });
}
