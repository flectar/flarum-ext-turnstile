<?php

/*
 * This file is part of flectar/flarum-turnstile.
 *
 * Copyright (c) 2025 Flectar.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile\Middleware;

use Flectar\Turnstile\Validator\TurnstileValidator;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CheckTurnstile implements MiddlewareInterface
{
    protected $validator;
    protected $settings;

    public function __construct(
        TurnstileValidator $validator,
        SettingsRepositoryInterface $settings,
    ) {
        $this->validator = $validator;
        $this->settings = $settings;
    }

    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        $path = $request->getUri()->getPath();

        if (
            $request->getMethod() === "POST" &&
            ($path === "/api/users" || $path === "/users")
        ) {
            if ($this->settings->get("flectar-turnstile.signup")) {
                $body = $request->getParsedBody();
                $token = Arr::get($body, "data.attributes.turnstileToken");

                $this->validator->assertValid(["turnstileToken" => $token]);

                if (isset($body["data"]["attributes"]["turnstileToken"])) {
                    unset($body["data"]["attributes"]["turnstileToken"]);
                    $request = $request->withParsedBody($body);
                }
            }
        }

        return $handler->handle($request);
    }
}
