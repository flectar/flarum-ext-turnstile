import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin()
    .setting(() => ({
      setting: 'flectar-turnstile.site_key',
      type: 'text',
      label: flarum.translator.trans('flectar-turnstile.admin.settings.site_key'),
      help: flarum.translator.trans('flectar-turnstile.admin.settings.help_text', {
        a: <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noopener" />,
      }),
    }))
    .setting(() => ({
      setting: 'flectar-turnstile.secret_key',
      type: 'text',
      label: flarum.translator.trans('flectar-turnstile.admin.settings.secret_key'),
    }))
    .setting(() => ({
      setting: 'flectar-turnstile.signup',
      type: 'bool',
      label: flarum.translator.trans('flectar-turnstile.admin.settings.signup'),
    }))
    .setting(() => ({
      setting: 'flectar-turnstile.signin',
      type: 'bool',
      label: flarum.translator.trans('flectar-turnstile.admin.settings.signin'),
    }))
    .setting(() => ({
      setting: 'flectar-turnstile.forgot',
      type: 'bool',
      label: flarum.translator.trans('flectar-turnstile.admin.settings.forgot'),
    })),
];
