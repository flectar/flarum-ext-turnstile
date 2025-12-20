<?php

/*
 * This file is part of flectar/flarum-turnstile.
 *
 * Copyright (c) 2025 Flectar.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile;

use Flarum\Foundation\AbstractServiceProvider;
use Flectar\Turnstile\Middleware\CheckTurnstile;

class TurnstileServiceProvider extends AbstractServiceProvider
{
    public function register()
    {
        // No registration needed
    }

    public function boot()
    {
        $this->container->extend("flarum.api.middleware", function (
            $middleware,
        ) {
            $middleware[] = CheckTurnstile::class;
            return $middleware;
        });
    }
}
