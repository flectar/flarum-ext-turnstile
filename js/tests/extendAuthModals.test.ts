import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from './fixtures/app';
import extendAuthModalsWithTurnstile from '../src/forum/extendAuthModals';
import type TurnstileState from '../src/common/states/TurnstileState';

vi.mock('../../vendor/flarum/core/js/src/common/app', () => ({
  default: { currentInitializerExtension: 'flectar-turnstile', handleErrorOnce: vi.fn() },
}));
vi.mock('../src/forum/components/Turnstile', () => ({ default: class {} }));

const modalNames = ['ForgotPasswordModal', 'LogInModal', 'SignUpModal', 'ChangePasswordModal'];

// Mirrors the structure of core's submit field so the held state can be checked on its button.
function createFields() {
  const items = new Map<string, any>([
    ['submit', { tag: 'div', attrs: { className: 'Form-group' }, children: [{ tag: 'Button', attrs: { type: 'submit', loading: false } }] }],
  ]);

  return {
    add: (key: string, content: unknown) => items.set(key, content),
    has: (key: string) => items.has(key),
    get: (key: string) => items.get(key),
  };
}

function createModalClass() {
  return class {
    turnstile!: TurnstileState;
    loading = false;
    alertAttrs: unknown = null;
    submissions: SubmitEvent[] = [];
    oninit() {}
    onsubmit(e: SubmitEvent) {
      e.preventDefault();
      this.submissions.push(e);
    }
    fields() {
      return createFields();
    }
    onerror(_error: unknown) {}
    loaded() {
      this.loading = false;
    }
  };
}

const submitEvent = () => new Event('submit', { cancelable: true }) as SubmitEvent;

describe.each(modalNames)('%s Turnstile recovery', (modalName) => {
  let modal: InstanceType<ReturnType<typeof createModalClass>>;
  let api: {
    render: ReturnType<typeof vi.fn<NonNullable<Window['turnstile']>['render']>>;
    reset: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let redraw: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const modals = Object.fromEntries(modalNames.map((name) => [name, createModalClass()]));
    redraw = vi.fn();
    vi.stubGlobal('m', Object.assign(vi.fn(), { redraw }));
    // Exercise Flarum's actual method extenders, including lazy module registration.
    vi.stubGlobal('flarum', {
      reg: {
        namespaceAndIdFromPath: (path: string) => ['flarum', path.split('/').pop()],
        onLoad: (_namespace: string, id: string, callback: (module: unknown) => void) => callback(modals[id]),
      },
    });
    vi.spyOn(app.forum, 'attribute').mockReturnValue('test-site-key');
    api = {
      render: vi.fn<NonNullable<Window['turnstile']>['render']>().mockReturnValue('widget-id'),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    window.turnstile = api;
    extendAuthModalsWithTurnstile();
    modal = new modals[modalName]();
    modal.oninit();
    const container = document.createElement('div');
    document.body.appendChild(container);
    await modal.turnstile.render(container);
  });

  afterEach(() => {
    modal.turnstile.remove();
    delete window.turnstile;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('shows widget errors without finishing an in-flight request or forcing a reset', () => {
    modal.loading = true;
    api.render.mock.calls[0][1]['error-callback']();

    expect(modal.alertAttrs).toEqual({ type: 'error', content: 'flectar-turnstile.forum.error' });
    expect(modal.loading).toBe(true);
    expect(api.reset).not.toHaveBeenCalled();
    expect(redraw).toHaveBeenCalled();
  });

  it('clears its previous widget error after Cloudflare recovers', () => {
    const options = api.render.mock.calls[0][1];
    options['error-callback']();
    redraw.mockClear();
    options.callback('fresh-token');

    expect(modal.turnstile.getResponse()).toBe('fresh-token');
    expect(modal.alertAttrs).toBeNull();
    expect(redraw).toHaveBeenCalled();
  });

  it('preserves a newer form error when Cloudflare recovers', () => {
    const options = api.render.mock.calls[0][1];
    options['error-callback']();
    const formError = { type: 'error', content: 'Invalid credentials' };
    modal.alertAttrs = formError;
    options.callback('fresh-token');

    expect(modal.alertAttrs).toBe(formError);
  });

  it('holds an early submission and sends it once Cloudflare provides a token', () => {
    const submitButton = () => modal.fields().get('submit').children[0].attrs;
    const event = submitEvent();
    modal.onsubmit(event);

    expect(event.defaultPrevented).toBe(true);
    expect(modal.submissions).toHaveLength(0);
    expect(submitButton()).toEqual({ type: 'submit', loading: true, 'aria-disabled': 'true' });

    api.render.mock.calls[0][1].callback('fresh-token');

    expect(modal.submissions).toEqual([event]);
    expect(submitButton()).toEqual({ type: 'submit', loading: false });
    expect(redraw).toHaveBeenCalled();
  });

  it('submits straight away once Cloudflare has provided a token', () => {
    api.render.mock.calls[0][1].callback('fresh-token');
    const event = submitEvent();
    modal.onsubmit(event);

    expect(modal.submissions).toEqual([event]);
  });

  it('asks the visitor to complete an interactive challenge, then continues', () => {
    const options = api.render.mock.calls[0][1];
    modal.onsubmit(submitEvent());
    options['before-interactive-callback']();

    expect(modal.alertAttrs).toEqual({ type: 'error', content: 'flectar-turnstile.forum.validation_error' });
    expect(modal.fields().get('submit').children[0].attrs.loading).toBe(false);

    options.callback('fresh-token');

    expect(modal.submissions).toHaveLength(1);
    expect(modal.alertAttrs).toBeNull();
  });

  it('only resets the widget after a failed request that carried a token', () => {
    modal.onerror({ alert: { type: 'error', content: 'Something went wrong' } });
    expect(api.reset).not.toHaveBeenCalled();

    api.render.mock.calls[0][1].callback('used-token');
    modal.onerror({ alert: { type: 'error', content: 'Invalid credentials' } });

    expect(api.reset).toHaveBeenCalledWith('widget-id');
  });

  it.runIf(modalName === 'ChangePasswordModal')('only resets the widget after a failed reset request that carried a token', () => {
    modal.loaded();
    expect(api.reset).not.toHaveBeenCalled();

    api.render.mock.calls[0][1].callback('used-token');
    modal.loaded();

    expect(api.reset).toHaveBeenCalledWith('widget-id');
  });
});
