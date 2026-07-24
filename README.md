[![Latest Stable Version](https://poser.pugx.org/flectar/flarum-turnstile/v)](https://packagist.org/packages/flectar/flarum-turnstile) [![Total Downloads](https://poser.pugx.org/flectar/flarum-turnstile/downloads)](https://packagist.org/packages/flectar/flarum-turnstile)  [![License](https://poser.pugx.org/flectar/flarum-turnstile/license)](https://packagist.org/packages/flectar/flarum-turnstile)

---

## 🔐 Cloudflare Turnstile for Flarum

This extension integrates [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/), a modern CAPTCHA alternative, directly into your Flarum forum for enhanced security. Turnstile is a user-friendly and privacy-respecting CAPTCHA service that protects forms from abuse without requiring user interaction in most cases.

---

### 🚀 Features

- Protect Signup, Login, and Forgot Password modals with Cloudflare Turnstile integration.
- Toggle protection per modal via the admin dashboard settings.
- Seamless support for both light and dark themes.

---

### ⚠ Minimum Requirements

- Flarum v2.0.0-rc.4 or higher
- PHP 8.3 or higher

---

### 📥 Installation

Run the following command in your Flarum root directory:

```bash
composer require flectar/flarum-turnstile:"*"
```

Then enable the extension in the Admin Dashboard and configure your Turnstile site and secret keys.

You can get your keys from the [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile).

---

### ♻️ Updating

To update the extension, simply run:

```bash
composer update flectar/flarum-turnstile:"*"
php flarum migrate
php flarum cache:clear
```

---

### 📄 License

- Open-sourced under the [MIT License](https://github.com/flectar/flarum-ext-turnstile/blob/main/LICENSE).

---

### 🔗 Useful Links

- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
- [Flectar](https://flectar.com/)
- [Packagist - flectar/flarum-turnstile](https://packagist.org/packages/flectar/flarum-turnstile)
- [GitHub Repo](https://github.com/flectar/flarum-ext-turnstile)
- [Composer](https://getcomposer.org/)
- [Flarum](https://flarum.org/)
- [Flarum Discuss Community](https://discuss.flarum.org/)

---
