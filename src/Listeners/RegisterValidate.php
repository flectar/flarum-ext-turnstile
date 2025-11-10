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

use Flectar\Turnstile\Validator\TurnstileValidator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Event\Saving;
use Illuminate\Support\Arr;

class RegisterValidate
{
    /**
     * @var TurnstileValidator
     */
    protected $validator;

    /**
     * @var SettingsRepositoryInterface
     */
    protected $settings;

    public function __construct(TurnstileValidator $validator, SettingsRepositoryInterface $settings)
    {
        $this->validator = $validator;
        $this->settings = $settings;
    }

    public function handle(Saving $event)
    {
        // We also check for the actor's admin status, so that we can allow admins to create users from the admin panel without a Turnstile token.
        if (! $event->user->exists && $this->settings->get('flectar-turnstile.signup') && ! $event->actor->isAdmin()) {
            $this->validator->assertValid([
                'turnstile' => Arr::get($event->data, 'attributes.turnstileToken'),
            ]);
        }
    }
}
