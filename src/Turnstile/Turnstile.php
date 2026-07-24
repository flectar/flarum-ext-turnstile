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

namespace Flectar\Turnstile\Turnstile;

use Flarum\Settings\SettingsRepositoryInterface;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;

class Turnstile
{
    protected string $secretKey;
    protected ClientInterface $client;

    public function __construct(SettingsRepositoryInterface $settings, ?ClientInterface $client = null)
    {
        $secretKey = $settings->get('flectar-turnstile.secret_key');
        $this->secretKey = is_string($secretKey) ? trim($secretKey) : '';
        $this->client = $client ?? new Client([
            'base_uri' => 'https://challenges.cloudflare.com/turnstile/v0/',
            'connect_timeout' => 5,
            'timeout' => 10,
        ]);
    }

    /**
     * Validate a single-use Turnstile token with Cloudflare.
     */
    public function verify(string $response): bool
    {
        if ($this->secretKey === '' || $response === '' || strlen($response) > 2048) {
            return false;
        }

        try {
            $response = $this->client->request('POST', 'siteverify', [
                'form_params' => [
                    'secret' => $this->secretKey,
                    'response' => $response,
                ],
            ]);

            $result = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return false;
        }

        return is_array($result) && ($result['success'] ?? false) === true;
    }
}
