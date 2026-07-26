<?php

/*
 * This file is part of flectar/flarum-turnstile.
 *
 * Copyright (c) 2026 Flectar.
 * Copyright (c) 2022 Blomstra Ltd.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile;

use Flectar\Turnstile\Listeners\AddValidatorRule;
use Flectar\Turnstile\Middleware\ValidateApiToken;
use Flectar\Turnstile\Middleware\ValidateLogin;
use Flectar\Turnstile\Validator\TurnstileValidator;
use Flarum\Api\ForgotPasswordValidator;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\User\Event\Saving as UserSaving;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Settings())
        ->default('flectar-turnstile.secret_key', null)
        ->default('flectar-turnstile.site_key', null)
        ->default('flectar-turnstile.signup', true)
        ->default('flectar-turnstile.signin', false)
        ->default('flectar-turnstile.forgot', true)
        ->serializeToForum('flectar-turnstile.site_key', 'flectar-turnstile.site_key')
        ->serializeToForum('flectar-turnstile.signup', 'flectar-turnstile.signup', 'boolval')
        ->serializeToForum('flectar-turnstile.signin', 'flectar-turnstile.signin', 'boolval')
        ->serializeToForum('flectar-turnstile.forgot', 'flectar-turnstile.forgot', 'boolval'),

    (new Extend\Validator(TurnstileValidator::class))
        ->configure(AddValidatorRule::class),

    (new Extend\Validator(ForgotPasswordValidator::class))
        ->configure(AddValidatorRule::class),

    (new Extend\ApiResource(UserResource::class))
        ->fields(fn () => [
            Schema\Str::make('turnstileToken')
                ->maxLength(2048)
                ->visible(false)
                ->writableOnCreate()
                ->set(fn () => null)
                ->save(fn () => null),
        ]),

    (new Extend\Middleware('forum'))
        ->add(ValidateLogin::class),

    (new Extend\Middleware('api'))
        ->add(ValidateApiToken::class),

    (new Extend\Event())
        ->listen(UserSaving::class, Listeners\RegisterValidate::class),
];
