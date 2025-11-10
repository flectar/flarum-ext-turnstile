import app from 'flarum/admin/app';

app.initializers.add('flectar/flarum-turnstile', () => {
  app.extensionData
    .for('flectar-turnstile')
    .registerSetting({
      setting: 'flectar-turnstile.site_key',
      type: 'text',
      label: app.translator.trans('flectar-turnstile.admin.settings.site_key'),
      help: app.translator.trans('flectar-turnstile.admin.settings.help_text', {
        a: <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noopener" />,
      }),
    })
    .registerSetting({
      setting: 'flectar-turnstile.secret_key',
      type: 'text',
      label: app.translator.trans('flectar-turnstile.admin.settings.secret_key'),
    })
    .registerSetting({
      setting: 'flectar-turnstile.signup',
      type: 'bool',
      label: app.translator.trans('flectar-turnstile.admin.settings.signup'),
    })
    .registerSetting({
      setting: 'flectar-turnstile.signin',
      type: 'bool',
      label: app.translator.trans('flectar-turnstile.admin.settings.signin'),
    })
    .registerSetting({
      setting: 'flectar-turnstile.forgot',
      type: 'bool',
      label: app.translator.trans('flectar-turnstile.admin.settings.forgot'),
    });
});
