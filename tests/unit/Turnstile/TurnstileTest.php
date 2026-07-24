<?php

/*
 * This file is part of flectar/flarum-turnstile.
 *
 * Copyright (c) 2026 Flectar.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile\Tests\unit\Turnstile;

use Flectar\Turnstile\Turnstile\Turnstile;
use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class TurnstileTest extends TestCase
{
    #[Test]
    public function it_accepts_a_successful_siteverify_response(): void
    {
        $turnstile = $this->turnstileWithResponse(new Response(200, [], '{"success":true}'));

        $this->assertTrue($turnstile->verify('valid-token'));
    }

    #[Test]
    public function it_rejects_an_unsuccessful_siteverify_response(): void
    {
        $turnstile = $this->turnstileWithResponse(new Response(200, [], '{"success":false}'));

        $this->assertFalse($turnstile->verify('invalid-token'));
    }

    #[Test]
    public function it_fails_closed_when_cloudflare_is_unavailable(): void
    {
        $exception = new ConnectException('Connection failed', new Request('POST', 'siteverify'));
        $turnstile = $this->turnstileWithResponse($exception);

        $this->assertFalse($turnstile->verify('unverifiable-token'));
    }

    #[Test]
    public function it_fails_closed_for_an_invalid_siteverify_response(): void
    {
        $turnstile = $this->turnstileWithResponse(new Response(200, [], 'not-json'));

        $this->assertFalse($turnstile->verify('unverifiable-token'));
    }

    #[Test]
    public function it_rejects_an_empty_secret_without_contacting_cloudflare(): void
    {
        $turnstile = $this->turnstileWithResponse(new Response(200, [], '{"success":true}'), '');

        $this->assertFalse($turnstile->verify('token'));
    }

    private function turnstileWithResponse(mixed $response, string $secret = 'test-secret'): Turnstile
    {
        $settings = $this->createMock(SettingsRepositoryInterface::class);
        $settings
            ->expects($this->once())
            ->method('get')
            ->with('flectar-turnstile.secret_key')
            ->willReturn($secret);

        $handler = HandlerStack::create(new MockHandler([$response]));
        $client = new Client([
            'base_uri' => 'https://challenges.cloudflare.com/turnstile/v0/',
            'handler' => $handler,
        ]);

        return new Turnstile($settings, $client);
    }
}
