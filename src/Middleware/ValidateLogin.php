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
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\MessageBag;
use Illuminate\Validation\ValidationException;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ValidateLogin implements MiddlewareInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected TurnstileValidator $validator,
        protected UrlGenerator $url
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (
            $request->getAttribute('routeName') === 'login'
            && $this->settings->get('flectar-turnstile.signin')
        ) {
            $body = $request->getParsedBody();

            // Login extensions can replace the controller and skip Flarum's LogInValidator.
            try {
                $this->validator->assertValid([
                    'turnstileToken' => is_array($body) ? Arr::get($body, 'turnstileToken') : null,
                ]);
            } catch (ValidationException $exception) {
                if (! RequestUtil::isHtmlRequest($request)) {
                    throw $exception;
                }

                // Match Flarum's HTML login flow so the visitor can retry with a fresh challenge.
                $request->getAttribute('session')->put('errors', new MessageBag($exception->errors()));

                return new RedirectResponse($this->url->to('forum')->route('maintenance.login'));
            }
        }

        return $handler->handle($request);
    }
}
