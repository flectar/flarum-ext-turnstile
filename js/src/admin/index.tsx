flarum.extensions['flectar-turnstile'].registerSetting({
  setting: 'flectar-turnstile.site_key',
  type: 'text',
  label: flarum.translator.trans('flectar-turnstile.admin.settings.site_key'),
  help: flarum.translator.trans('flectar-turnstile.admin.settings.help_text', {
    a: <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noopener" />,
  }),
});

flarum.extensions['flectar-turnstile'].registerSetting({
  setting: 'flectar-turnstile.secret_key',
  type: 'text',
  label: flarum.translator.trans('flectar-turnstile.admin.settings.secret_key'),
});

flarum.extensions['flectar-turnstile'].registerSetting({
  setting: 'flectar-turnstile.signup',
  type: 'bool',
  label: flarum.translator.trans('flectar-turnstile.admin.settings.signup'),
});

flarum.extensions['flectar-turnstile'].registerSetting({
  setting: 'flectar-turnstile.signin',
  type: 'bool',
  label: flarum.translator.trans('flectar-turnstile.admin.settings.signin'),
});

flarum.extensions['flectar-turnstile'].registerSetting({
  setting: 'flectar-turnstile.forgot',
  type: 'bool',
  label: flarum.translator.trans('flectar-turnstile.admin.settings.forgot'),
});
