import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from './fixtures/app';
import extendAuthModalsWithTurnstile from '../src/forum/extendAuthModals';
import type TurnstileState from '../src/common/states/TurnstileState';

vi.mock('../../vendor/flarum/core/js/src/common/app', () => ({
  default: { currentInitializerExtension: 'flectar-turnstile', handleErrorOnce: vi.fn() },
}));
vi.mock('../src/forum/components/Turnstile', () => ({ default: class {} }));

const modalNames = ['ForgotPasswordModal', 'LogInModal', 'SignUpModal', 'ChangePasswordModal'];

function createModalClass() {
  return class {
    turnstile!: TurnstileState;
    loading = false;
    alertAttrs: unknown = null;
    oninit() {}
    loaded() {
      this.loading = false;
    }
  };
}

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
    vi.stubGlobal('m', { redraw });
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
});
