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
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\DataProvider;
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
        $settings = $this->createStub(SettingsRepositoryInterface::class);
        $settings->method('get')->willReturn('   ');
        $client = $this->createMock(ClientInterface::class);
        $client->expects($this->never())->method('request');
        $turnstile = new Turnstile($settings, $client);

        $this->assertFalse($turnstile->verify('token'));
    }

    #[Test]
    #[DataProvider('invalidTokens')]
    public function it_rejects_invalid_token_lengths_without_contacting_cloudflare(string $token): void
    {
        $settings = $this->createStub(SettingsRepositoryInterface::class);
        $settings->method('get')->willReturn('test-secret');
        $client = $this->createMock(ClientInterface::class);
        $client->expects($this->never())->method('request');

        $this->assertFalse((new Turnstile($settings, $client))->verify($token));
    }

    public static function invalidTokens(): array
    {
        return [
            'empty' => [''],
            'too long' => [str_repeat('a', 2049)],
        ];
    }

    #[Test]
    #[DataProvider('invalidResponses')]
    public function it_requires_an_explicit_boolean_success(string $body): void
    {
        $turnstile = $this->turnstileWithResponse(new Response(200, [], $body));

        $this->assertFalse($turnstile->verify('token'));
    }

    public static function invalidResponses(): array
    {
        return [
            'missing success' => ['{}'],
            'null' => ['null'],
            'scalar' => ['true'],
            'list' => ['[true]'],
            'string success' => ['{"success":"true"}'],
            'integer success' => ['{"success":1}'],
            'expired or reused' => ['{"success":false,"error-codes":["timeout-or-duplicate"]}'],
        ];
    }

    #[Test]
    public function it_fails_closed_for_an_http_error(): void
    {
        $turnstile = $this->turnstileWithResponse(new Response(503, [], '{"success":true}'));

        $this->assertFalse($turnstile->verify('token'));
    }

    #[Test]
    public function it_posts_the_token_and_trimmed_secret_to_siteverify(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([new Response(200, [], '{"success":true}')]));
        $handler->push(Middleware::history($history));
        $settings = $this->createStub(SettingsRepositoryInterface::class);
        $settings->method('get')->willReturn(' test-secret ');
        $client = new Client([
            'base_uri' => 'https://challenges.cloudflare.com/turnstile/v0/',
            'handler' => $handler,
        ]);

        $this->assertTrue((new Turnstile($settings, $client))->verify(str_repeat('a', 2048)));
        $this->assertCount(1, $history);
        $request = $history[0]['request'];
        $this->assertSame('POST', $request->getMethod());
        $this->assertSame('https://challenges.cloudflare.com/turnstile/v0/siteverify', (string) $request->getUri());
        parse_str((string) $request->getBody(), $body);
        $this->assertSame(['secret' => 'test-secret', 'response' => str_repeat('a', 2048)], $body);
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
