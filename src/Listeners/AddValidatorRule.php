<?php

/*
 * This file is part of flectar/turnstile.
 *
 * Copyright (c) 2026 Flectar.
 * Copyright (c) 2022 Blomstra Ltd.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile\Listeners;

use Flectar\Turnstile\Turnstile\Turnstile;
use Flarum\Api\ForgotPasswordValidator;
use Flarum\Foundation\AbstractValidator;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Validation\Validator;

class AddValidatorRule
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected Turnstile $turnstile
    ) {
    }

    public function __invoke(AbstractValidator $flarumValidator, Validator $validator): void
    {
        $validator->addExtension(
            'turnstile',
            fn ($attribute, $value) => is_string($value) && $this->turnstile->verify($value)
        );

        if ($flarumValidator instanceof ForgotPasswordValidator && $this->settings->get('flectar-turnstile.forgot')) {
            $validator->addRules([
                'turnstileToken' => ['required', 'turnstile'],
            ]);
        }
    }
}
