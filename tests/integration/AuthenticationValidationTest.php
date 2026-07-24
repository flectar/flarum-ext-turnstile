<?php

/*
 * This file is part of flectar/flarum-turnstile.
 *
 * Copyright (c) 2026 Flectar.
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace Flectar\Turnstile\Tests\integration;

use Flectar\Turnstile\Turnstile\Turnstile;
use Flarum\Extend;
use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

class AuthenticationValidationTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setting('flectar-turnstile.secret_key', 'test-secret');
        $this->setting('flectar-turnstile.signin', true);
        $this->setting('flectar-turnstile.signup', true);
        $this->setting('flectar-turnstile.forgot', true);
        $this->extension('flectar-turnstile');
        $this->extend(
            (new Extend\Csrf())
                ->exemptRoute('login')
                ->exemptRoute('register')
                ->exemptRoute('forgot'),
            (new Extend\ServiceProvider())->register(FakeTurnstileServiceProvider::class)
        );

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
            ],
        ]);
    }

    #[Test]
    public function login_rejects_a_missing_turnstile_token(): void
    {
        $response = $this->sendLoginRequest();

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function login_accepts_a_valid_token_and_its_internal_api_request(): void
    {
        $response = $this->sendLoginRequest('valid-turnstile-token');

        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function login_rejects_an_invalid_turnstile_token(): void
    {
        $response = $this->sendLoginRequest('invalid-turnstile-token');

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function direct_api_token_request_rejects_a_missing_turnstile_token(): void
    {
        $response = $this->sendApiTokenRequest();

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function direct_api_token_request_accepts_a_valid_turnstile_token(): void
    {
        $response = $this->sendApiTokenRequest('valid-turnstile-token');

        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function direct_api_token_request_rejects_an_invalid_turnstile_token(): void
    {
        $response = $this->sendApiTokenRequest('invalid-turnstile-token');

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function direct_api_token_request_is_unchanged_when_signin_protection_is_disabled(): void
    {
        $this->setting('flectar-turnstile.signin', false);

        $response = $this->sendApiTokenRequest();

        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function registration_rejects_a_missing_turnstile_token(): void
    {
        $response = $this->sendRegistrationRequest();

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function registration_accepts_the_turnstile_token_field(): void
    {
        $response = $this->sendRegistrationRequest('valid-turnstile-token');

        $this->assertSame(201, $response->getStatusCode(), (string) $response->getBody());

        $body = json_decode((string) $response->getBody(), true);

        $this->assertArrayNotHasKey('turnstileToken', $body['data']['attributes']);
    }

    #[Test]
    public function registration_rejects_an_invalid_turnstile_token(): void
    {
        $response = $this->sendRegistrationRequest('invalid-turnstile-token');

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function registration_is_unchanged_when_signup_protection_is_disabled(): void
    {
        $this->setting('flectar-turnstile.signup', false);

        $response = $this->sendRegistrationRequest();

        $this->assertSame(201, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function admin_can_create_a_user_without_a_turnstile_token(): void
    {
        $response = $this->send(
            $this->request('POST', '/api/users', [
                'authenticatedAs' => 1,
                'json' => [
                    'data' => [
                        'type' => 'users',
                        'attributes' => [
                            'username' => 'admin-created',
                            'password' => 'too-obscure',
                            'email' => 'admin-created@machine.local',
                        ],
                    ],
                ],
            ])
        );

        $this->assertSame(201, $response->getStatusCode(), (string) $response->getBody());

        $user = User::where('username', 'admin-created')->first();

        $this->assertNotNull($user);
        $this->assertSame('admin-created@machine.local', $user->email);
    }

    #[Test]
    public function forgot_password_rejects_a_missing_turnstile_token(): void
    {
        $response = $this->sendForgotPasswordRequest();

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function forgot_password_accepts_a_valid_turnstile_token(): void
    {
        $response = $this->sendForgotPasswordRequest('valid-turnstile-token');

        $this->assertSame(204, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function signed_in_password_change_rejects_a_missing_turnstile_token(): void
    {
        $response = $this->sendForgotPasswordRequest(authenticatedAs: 2);

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function signed_in_password_change_accepts_a_valid_turnstile_token(): void
    {
        $response = $this->sendForgotPasswordRequest('valid-turnstile-token', 2);

        $this->assertSame(204, $response->getStatusCode(), (string) $response->getBody());
    }

    private function sendLoginRequest(?string $turnstileToken = null)
    {
        return $this->send(
            $this->request('POST', '/login', [
                'json' => array_filter([
                    'identification' => 'normal',
                    'password' => 'too-obscure',
                    'remember' => false,
                    'turnstileToken' => $turnstileToken,
                ], fn ($value) => $value !== null),
            ])
        );
    }

    private function sendApiTokenRequest(?string $turnstileToken = null)
    {
        return $this->send(
            $this->request('POST', '/api/token', [
                'json' => array_filter([
                    'identification' => 'normal',
                    'password' => 'too-obscure',
                    'turnstileToken' => $turnstileToken,
                ], fn ($value) => $value !== null),
            ])
        );
    }

    private function sendRegistrationRequest(?string $turnstileToken = null)
    {
        return $this->send(
            $this->request('POST', '/register', [
                'json' => array_filter([
                    'username' => 'new-user',
                    'password' => 'too-obscure',
                    'email' => 'new-user@machine.local',
                    'turnstileToken' => $turnstileToken,
                ], fn ($value) => $value !== null),
            ])
        );
    }

    private function sendForgotPasswordRequest(?string $turnstileToken = null, ?int $authenticatedAs = null)
    {
        $options = [
            'json' => array_filter([
                'email' => 'normal@machine.local',
                'turnstileToken' => $turnstileToken,
            ], fn ($value) => $value !== null),
        ];

        if ($authenticatedAs !== null) {
            $options['authenticatedAs'] = $authenticatedAs;
        }

        return $this->send(
            $this->request('POST', '/api/forgot', $options)
        );
    }
}

class FakeTurnstileServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->singleton(Turnstile::class, FakeTurnstile::class);
    }
}

class FakeTurnstile extends Turnstile
{
    public function __construct()
    {
    }

    public function verify(string $response): bool
    {
        return $response === 'valid-turnstile-token';
    }
}
