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
      'before-interactive-callback': () => void;
      'after-interactive-callback': () => void;
      'timeout-callback': () => void;
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
const HELD_SUBMIT_TIMEOUT = 10_000;

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
  interactive = false;
  /** Translation key of the latest status, announced to screen readers. */
  message: string | null = null;
  private failure: string | null = null;
  private heldSubmit: (() => void) | null = null;
  private heldSubmitTimeout: number | undefined;

  constructor(
    private callback: (token: string) => void,
    private errorCallback: (alertAttrs: { type: 'error'; content: unknown }) => void
  ) {}

  async render(element: HTMLElement | null, theme: 'light' | 'dark' | 'auto' = 'auto') {
    const generation = ++this.renderGeneration;
    this.failure = null;
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
          this.interactive = false;
          this.failure = this.message = null;
          this.callback(token);
          this.releaseSubmit();
        },
        'expired-callback': () => {
          if (generation === this.renderGeneration) this.token = null;
        },
        'error-callback': () => {
          if (generation === this.renderGeneration) {
            this.reportError('flectar-turnstile.forum.error');
          }
        },
        'before-interactive-callback': () => {
          if (generation !== this.renderGeneration) return;

          this.interactive = true;
          if (this.heldSubmit) this.promptInteraction();
        },
        'after-interactive-callback': () => {
          if (generation !== this.renderGeneration) return;

          this.interactive = false;
          if (this.heldSubmit) this.waitForToken();
        },
        'timeout-callback': () => {
          // Cloudflare restarts an unsolved interactive challenge, so don't submit long after the visitor asked to.
          if (generation === this.renderGeneration) {
            this.interactive = false;
            this.cancelSubmit();
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

  /**
   * Run a form submission now if a token is ready. Otherwise hold it until
   * Turnstile produces one, instead of sending a request that has to fail.
   */
  submitWhenReady(submit: () => void) {
    if (this.token) return submit();
    if (this.failure) return this.reportError(this.failure);

    const alreadyHeld = !!this.heldSubmit;
    this.heldSubmit = submit;

    if (this.interactive) {
      this.promptInteraction();
    } else if (!alreadyHeld) {
      this.message = 'flectar-turnstile.forum.verifying';
      this.waitForToken();
    }
  }

  /**
   * Whether a held submission is waiting on a challenge that needs nothing from the visitor.
   */
  isWaiting() {
    return !!this.heldSubmit && !this.interactive;
  }

  /**
   * Drop a held submission, returning whether there was one.
   */
  cancelSubmit() {
    if (!this.heldSubmit) return false;

    window.clearTimeout(this.heldSubmitTimeout);
    this.heldSubmit = this.message = null;

    return true;
  }

  reset() {
    this.token = null;
    this.interactive = false;

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
    this.interactive = false;
    this.cancelSubmit();

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

  private releaseSubmit() {
    const submit = this.heldSubmit;

    this.cancelSubmit();
    submit?.();
  }

  private waitForToken() {
    window.clearTimeout(this.heldSubmitTimeout);
    this.heldSubmitTimeout = window.setTimeout(() => {
      this.cancelSubmit();
      this.alert('flectar-turnstile.forum.slow_error');
    }, HELD_SUBMIT_TIMEOUT);
  }

  // The visitor has to solve this one, so stop the timeout and keep the submission until they do.
  private promptInteraction() {
    window.clearTimeout(this.heldSubmitTimeout);
    this.alert('flectar-turnstile.forum.validation_error');
  }

  private reportError(translationKey: string) {
    this.token = null;
    this.interactive = false;
    this.failure = translationKey;
    this.cancelSubmit();
    this.alert(translationKey);
  }

  private alert(translationKey: string) {
    this.message = translationKey;
    this.errorCallback({
      type: 'error',
      content: app.translator.trans(translationKey),
    });
  }
}
