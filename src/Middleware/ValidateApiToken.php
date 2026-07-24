<?php

/*
 * This file is part of flectar/flarum-turnstile.
 *
 * Copyright (c) 2026 Flectar.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile\Middleware;

use Flectar\Turnstile\Validator\TurnstileValidator;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ValidateApiToken implements MiddlewareInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected TurnstileValidator $validator
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (
            $request->getAttribute('routeName') === 'token'
            && ! RequestUtil::isInternal($request)
            && $this->settings->get('flectar-turnstile.signin')
        ) {
            $body = $request->getParsedBody();

            $this->validator->assertValid([
                'turnstileToken' => is_array($body) ? Arr::get($body, 'turnstileToken') : null,
            ]);
        }

        return $handler->handle($request);
    }
}
