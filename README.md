# Cloudflare Turnstile for Flarum

[![Latest Stable Version](https://poser.pugx.org/flectar/flarum-turnstile/v)](https://packagist.org/packages/flectar/flarum-turnstile) [![Total Downloads](https://poser.pugx.org/flectar/flarum-turnstile/downloads)](https://packagist.org/packages/flectar/flarum-turnstile) [![License](https://poser.pugx.org/flectar/flarum-turnstile/license)](LICENSE.md)

Adds [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) CAPTCHA protection to Flarum's signup, login, and password reset forms, with independent settings for each and support for light and dark themes.

## Compatibility

| Branch | Flarum | PHP |
| --- | --- | --- |
| `2.x` | Stable 2.x | 8.3+ |
| `1.x` | 1.8.x | Flarum 1.8 requirements |

## Installation

Run in your Flarum root directory:

```sh
composer require flectar/flarum-turnstile
php flarum cache:clear
```

Enable **Cloudflare Turnstile** in the admin dashboard, then configure it:

1. Create a Turnstile widget in the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/turnstile). Add your forum's hostname to its allowed hostnames.
2. Save the matching **site key** and **secret key** in the extension settings. The site key is public; keep the secret key private.
3. Choose the forms to protect. Signup and password reset protection default to enabled; login protection defaults to disabled.
4. Test signup and password reset in a private browser window. Verify login protection before closing your existing admin session.

Protected forms reject requests when keys are missing or invalid, the challenge has expired, or verification is unavailable. Configure both keys before making the protected forms available to users.

## Protection scope

- Signup is validated on the server, including direct API user creation. Administrators can create users without a challenge.
- Login protection also applies to direct `POST /api/token` requests. API clients using that endpoint must send a valid `turnstileToken` when login protection is enabled.
- Flarum's standalone maintenance login page includes the challenge when login protection is enabled.
- Password reset protection covers both the forgot-password form and the signed-in change-password form.
- Tokens are checked with Cloudflare on the server. Login's internal API request is exempt from a second check because tokens can only be verified once.

Third-party authentication flows that use other endpoints need their own integration.

## Updating

```sh
composer update flectar/flarum-turnstile --with-dependencies
php flarum cache:clear
```

## Troubleshooting

The browser must be able to load scripts and frames from `https://challenges.cloudflare.com`, and the forum server must be able to reach Cloudflare's verification endpoint over HTTPS. If you use a Content Security Policy, follow [Cloudflare's CSP guidance](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

If the widget cannot load, check browser blockers and network access, then refresh the page. If verification fails repeatedly, check the key pair and allowed hostnames in Cloudflare. Expired or already-used tokens require a new challenge.

If a configuration problem prevents administrator login, temporarily disable the extension from the Flarum root directory:

```sh
php flarum extension:disable flectar-turnstile
php flarum cache:clear
```

This removes Turnstile protection until you re-enable the extension and correct its configuration.

## Development

Use PHP 8.3+ with Composer and Node.js 24+ with npm. Install Composer dependencies first; TypeScript uses Flarum's bundled type declarations.

```sh
composer install
composer validate --strict
composer analyse:phpstan
cd js
npm ci
npm run format-check
npm run check-typings
npm test
npm run build
```

The production bundles in `js/dist` are distributed with the extension. Rebuild them after changing frontend code. CI checks formatting, TypeScript, frontend tests, PHPStan, and backend tests; pushes to `2.x` also refresh the committed bundles.

Backend tests use an isolated Flarum installation. For a local SQLite run from the extension root, with `pdo_sqlite` installed:

```sh
export DB_DRIVER=sqlite
export FLARUM_TEST_TMP_DIR_LOCAL="$PWD/tests/integration/tmp"
composer test:setup
composer test
```

The setup command recreates the configured test database. Use a dedicated test database when selecting MySQL, MariaDB, or PostgreSQL through `DB_*` variables. PHPStan also requires `pdo_sqlite` for its own isolated installation.

Tests mock Cloudflare responses and cover server-side authentication enforcement and the frontend widget lifecycle. Before a release, also smoke-test the forms in a real Flarum forum with your configured Cloudflare widget.

## License

The extension's code is released under the [MIT License](LICENSE.md). Cloudflare Turnstile is an external service loaded from Cloudflare.

## Links

- [Source and issues](https://github.com/flectar/flarum-ext-turnstile)
- [Packagist](https://packagist.org/packages/flectar/flarum-turnstile)
- [Cloudflare Turnstile documentation](https://developers.cloudflare.com/turnstile/)
- [Flectar](https://flectar.com/)
