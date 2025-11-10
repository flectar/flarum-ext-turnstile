<?php

/*
 * This file is part of flectar/turnstile.
 *
 * Copyright (c) 2025 Flectar.
 * Copyright (c) 2022 Blomstra Ltd.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile\Listeners;

use Flectar\Turnstile\Turnstile\Turnstile;
use Flarum\Api\ForgotPasswordValidator;
use Flarum\Forum\LogInValidator;
use Flarum\Foundation\AbstractValidator;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Validation\Validator;

class AddValidatorRule
{
    /**
     * @var SettingsRepositoryInterface
     */
    protected $settings;

    /**
     * @param SettingsRepositoryInterface $settings
     */
    public function __construct(SettingsRepositoryInterface $settings)
    {
        $this->settings = $settings;
    }

    public function __invoke(AbstractValidator $flarumValidator, Validator $validator)
    {
        $secret = $this->settings->get('flectar-turnstile.secret_key');

        $validator->addExtension(
            'turnstile',
            function ($attribute, $value) use ($secret) {
                if (! is_string($value) || ! is_string($secret)) {
                    return false;
                }

                return ! empty($value) && (new Turnstile($secret))->verify($value)['success'];
            }
        );

        if ($flarumValidator instanceof LogInValidator && $this->settings->get('flectar-turnstile.signin')) {
            $validator->addRules([
                'turnstileToken' => ['required', 'turnstile'],
            ]);
        }

        if ($flarumValidator instanceof ForgotPasswordValidator && $this->settings->get('flectar-turnstile.forgot')) {
            $validator->addRules([
                'turnstileToken' => ['required', 'turnstile'],
            ]);
        }
    }
}
