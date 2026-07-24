import app from 'flarum/forum/app';

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: 'light' | 'dark' | 'auto';
      size: 'flexible';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = 'flectar-turnstile-api';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_LOAD_TIMEOUT = 15_000;

let turnstileReady: Promise<boolean> | undefined;

function loadTurnstile(): Promise<boolean> {
  if (window.turnstile) return Promise.resolve(true);
  if (turnstileReady) return turnstileReady;

  const load = new Promise<boolean>((resolve) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);

    if (existingScript && !(existingScript instanceof HTMLScriptElement)) {
      resolve(false);
      return;
    }

    const script = existingScript ?? document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => finish(false), TURNSTILE_LOAD_TIMEOUT);

    const finish = (ready: boolean) => {
      if (settled) return;

      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);

      if (!ready) script.remove();

      resolve(ready);
    };
    const onLoad = () => finish(!!window.turnstile);
    const onError = () => finish(false);

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existingScript) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  turnstileReady = load.then((ready) => {
    if (!ready) turnstileReady = undefined;

    return ready;
  });

  return turnstileReady;
}

export default class TurnstileState {
  token: string | null = null;
  widgetId: string | undefined;
  renderGeneration = 0;

  constructor(
    private callback: (token: string) => void,
    private errorCallback: (alertAttrs: { type: 'error'; content: unknown }) => void
  ) {}

  async render(element: HTMLElement | null, theme: 'light' | 'dark' | 'auto' = 'auto') {
    const generation = ++this.renderGeneration;
    const ready = await loadTurnstile();

    if (generation !== this.renderGeneration || !element?.isConnected) return;

    if (!ready || !window.turnstile) {
      this.reportError('flectar-turnstile.forum.not_loaded_error');
      return;
    }

    try {
      this.widgetId = window.turnstile.render(element, {
        sitekey: app.forum.attribute('flectar-turnstile.site_key'),
        theme,
        size: 'flexible',
        callback: (token) => {
          if (generation !== this.renderGeneration) return;

          this.token = token;
          this.callback(token);
        },
        'expired-callback': () => {
          if (generation === this.renderGeneration) this.token = null;
        },
        'error-callback': () => {
          if (generation === this.renderGeneration) {
            this.reportError('flectar-turnstile.forum.error');
          }
        },
      });
    } catch {
      this.reportError('flectar-turnstile.forum.error');
    }
  }

  getResponse() {
    return this.token;
  }

  reset() {
    this.token = null;

    if (this.widgetId !== undefined && window.turnstile) {
      try {
        window.turnstile.reset(this.widgetId);
      } catch {
        this.widgetId = undefined;
      }
    }
  }

  remove() {
    ++this.renderGeneration;
    this.token = null;

    if (this.widgetId !== undefined && window.turnstile) {
      try {
        window.turnstile.remove(this.widgetId);
      } catch {
        // The widget may already have been removed by Turnstile.
      }

      this.widgetId = undefined;
    }
  }

  isReady() {
    return typeof window.turnstile !== 'undefined';
  }

  private reportError(translationKey: string) {
    this.token = null;
    this.errorCallback({
      type: 'error',
      content: app.translator.trans(translationKey),
    });
  }
}
