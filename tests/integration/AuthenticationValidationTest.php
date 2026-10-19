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
use Laminas\Diactoros\Response\JsonResponse;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

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
    public function login_is_unchanged_when_signin_protection_is_disabled(): void
    {
        $this->setting('flectar-turnstile.signin', false);

        $response = $this->sendLoginRequest();

        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function a_replacement_login_controller_cannot_bypass_a_missing_turnstile_token(): void
    {
        $this->replaceLoginController();

        $response = $this->sendLoginRequest();

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function a_replacement_login_controller_accepts_a_valid_turnstile_token(): void
    {
        $this->replaceLoginController();

        $response = $this->sendLoginRequest('valid-turnstile-token');

        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
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
    public function forgot_password_rejects_an_invalid_turnstile_token(): void
    {
        $response = $this->sendForgotPasswordRequest('invalid-turnstile-token');

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function forgot_password_is_unchanged_when_protection_is_disabled(): void
    {
        $this->setting('flectar-turnstile.forgot', false);

        $response = $this->sendForgotPasswordRequest();

        $this->assertSame(204, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function login_rejects_a_non_string_token_without_a_server_error(): void
    {
        $response = $this->send(
            $this->request('POST', '/login', [
                'json' => [
                    'identification' => 'normal',
                    'password' => 'too-obscure',
                    'turnstileToken' => ['valid-turnstile-token'],
                ],
            ])
        );

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
    }

    #[Test]
    public function direct_api_registration_cannot_bypass_turnstile(): void
    {
        $request = $this->request('POST', '/api/users', [
            'json' => [
                'data' => [
                    'type' => 'users',
                    'attributes' => [
                        'username' => 'api-created',
                        'password' => 'too-obscure',
                        'email' => 'api-created@machine.local',
                    ],
                ],
            ],
        ]);
        $response = $this->send($this->requestWithCsrfToken($request));

        $this->assertSame(422, $response->getStatusCode(), (string) $response->getBody());
        $this->assertStringContainsString('turnstileToken', (string) $response->getBody());
        $this->assertNull(User::where('username', 'api-created')->first());
    }

    #[Test]
    public function maintenance_login_renders_a_challenge_without_exposing_the_secret(): void
    {
        $this->setting('maintenance_mode', 'low');
        $this->setting('flectar-turnstile.site_key', 'public-site-key');

        $response = $this->send($this->request('GET', '/maintenance/login'));
        $html = (string) $response->getBody();

        $this->assertSame(200, $response->getStatusCode(), $html);
        $this->assertStringContainsString('data-sitekey="public-site-key"', $html);
        $this->assertStringContainsString('data-response-field-name="turnstileToken"', $html);
        $this->assertStringContainsString('https://challenges.cloudflare.com/turnstile/v0/api.js', $html);
        $this->assertStringNotContainsString('test-secret', $html);
    }

    #[Test]
    public function maintenance_login_omits_the_widget_when_protection_is_disabled(): void
    {
        $this->setting('maintenance_mode', 'low');
        $this->setting('flectar-turnstile.signin', false);

        $response = $this->send($this->request('GET', '/maintenance/login'));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringNotContainsString('challenges.cloudflare.com', (string) $response->getBody());
    }

    #[Test]
    public function html_login_redirects_back_to_the_challenge_when_validation_fails(): void
    {
        $this->setting('maintenance_mode', 'low');

        $request = $this->request('POST', '/login')
            ->withHeader('Accept', 'text/html')
            ->withParsedBody(['identification' => 'normal', 'password' => 'too-obscure']);
        $response = $this->send($request);

        $this->assertSame(302, $response->getStatusCode(), (string) $response->getBody());
        $this->assertStringEndsWith('/maintenance/login', $response->getHeaderLine('Location'));

        $retry = $this->send($this->requestWithCookiesFrom($this->request('GET', '/maintenance/login'), $response));

        $this->assertSame(200, $retry->getStatusCode());
        $this->assertStringContainsString('<div class="errors">', (string) $retry->getBody());
        $this->assertStringContainsString('turnstile token field is required', (string) $retry->getBody());
    }

    #[Test]
    public function html_login_accepts_a_valid_token_without_verifying_it_twice(): void
    {
        $this->setting('maintenance_mode', 'low');

        $request = $this->request('POST', '/login')
            ->withHeader('Accept', 'text/html')
            ->withParsedBody([
                'identification' => 'normal',
                'password' => 'too-obscure',
                'turnstileToken' => 'valid-turnstile-token',
            ]);
        $response = $this->send($request);

        $this->assertSame(302, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNotNull(User::findOrFail(2)->accessTokens()->first());
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
                    'twoFactorToken' => '',
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

    private function replaceLoginController(): void
    {
        $this->extend(
            (new Extend\Routes('forum'))
                ->remove('login')
                ->post('/login', 'login', ReplacementLogInController::class)
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
    private array $verifiedTokens = [];

    public function __construct()
    {
    }

    public function verify(string $response): bool
    {
        if ($response !== 'valid-turnstile-token' || isset($this->verifiedTokens[$response])) {
            return false;
        }

        $this->verifiedTokens[$response] = true;

        return true;
    }
}

class ReplacementLogInController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return new JsonResponse(['authenticated' => true]);
    }
}
