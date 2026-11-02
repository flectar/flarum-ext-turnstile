import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type TurnstileState from '../src/common/states/TurnstileState';

type TurnstileApi = NonNullable<Window['turnstile']>;
type RenderOptions = Parameters<TurnstileApi['render']>[1];

describe('Turnstile widget lifecycle', () => {
  let State: typeof TurnstileState;
  let element: HTMLDivElement;
  let callback: ReturnType<typeof vi.fn>;
  let errorCallback: ReturnType<typeof vi.fn>;
  let state: TurnstileState;

  function installApi() {
    const api = {
      render: vi.fn<TurnstileApi['render']>().mockReturnValue('widget-id'),
      reset: vi.fn<TurnstileApi['reset']>(),
      remove: vi.fn<TurnstileApi['remove']>(),
    };
    window.turnstile = api;
    return api;
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    delete window.turnstile;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    State = (await import('../src/common/states/TurnstileState')).default;
    element = document.createElement('div');
    document.body.appendChild(element);
    callback = vi.fn();
    errorCallback = vi.fn();
    state = new State(callback, errorCallback);
  });

  afterEach(() => {
    state.remove();
    delete window.turnstile;
    vi.useRealTimers();
  });

  it('renders with the configured key and theme, stores a token, and clears it on expiry', async () => {
    const api = installApi();
    await state.render(element, 'dark');

    expect(api.render).toHaveBeenCalledWith(element, expect.objectContaining({ sitekey: 'test-site-key', theme: 'dark', size: 'flexible' }));
    const options = api.render.mock.calls[0][1];
    options.callback('valid-token');
    expect(state.getResponse()).toBe('valid-token');
    expect(callback).toHaveBeenCalledWith('valid-token');

    options['expired-callback']();
    expect(state.getResponse()).toBeNull();
  });

  it('shares one script load between simultaneous widgets', async () => {
    const secondState = new State(vi.fn(), vi.fn());
    const secondElement = document.createElement('div');
    document.body.appendChild(secondElement);
    const firstRender = state.render(element);
    const secondRender = secondState.render(secondElement);

    expect(document.querySelectorAll('script')).toHaveLength(1);
    const script = document.querySelector('script')!;
    expect(script.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    const api = installApi();
    script.dispatchEvent(new Event('load'));
    await Promise.all([firstRender, secondRender]);

    expect(api.render).toHaveBeenCalledTimes(2);
    secondState.remove();
  });

  it.each(['error', 'timeout', 'load-without-api'])('reports a script %s and allows the next modal to retry', async (failure) => {
    const pending = state.render(element);
    const failedScript = document.querySelector('script')!;
    if (failure === 'timeout') {
      await vi.advanceTimersByTimeAsync(15_000);
    } else {
      failedScript.dispatchEvent(new Event(failure === 'error' ? 'error' : 'load'));
    }
    await pending;

    expect(state.getResponse()).toBeNull();
    expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.not_loaded_error' });
    expect(failedScript.isConnected).toBe(false);

    const retry = state.render(element);
    const replacement = document.querySelector('script')!;
    expect(replacement).not.toBe(failedScript);
    const api = installApi();
    replacement.dispatchEvent(new Event('load'));
    await retry;
    expect(api.render).toHaveBeenCalledOnce();
  });

  it('does not create a widget if the modal closes while its script loads', async () => {
    const pending = state.render(element);
    state.remove();
    const api = installApi();
    document.querySelector('script')!.dispatchEvent(new Event('load'));
    await pending;
    expect(api.render).not.toHaveBeenCalled();
    expect(errorCallback).not.toHaveBeenCalled();
  });

  it('ignores a detached widget container', async () => {
    const api = installApi();
    element.remove();
    await state.render(element);
    expect(api.render).not.toHaveBeenCalled();
  });

  it('ignores late callbacks after removal, including callbacks from an earlier widget', async () => {
    const api = installApi();
    await state.render(element);
    const previousOptions = api.render.mock.calls[0][1];
    previousOptions.callback('old-token');
    state.remove();
    expect(state.getResponse()).toBeNull();
    expect(api.remove).toHaveBeenCalledWith('widget-id');

    await state.render(element);
    api.render.mock.calls[1][1].callback('new-token');
    previousOptions.callback('stale-token');
    previousOptions['expired-callback']();
    previousOptions['error-callback']();
    expect(state.getResponse()).toBe('new-token');
    expect(errorCallback).not.toHaveBeenCalled();
  });

  it('clears a token and resets the widget after an unsuccessful form submission', async () => {
    const api = installApi();
    await state.render(element);
    api.render.mock.calls[0][1].callback('used-token');
    state.reset();
    expect(state.getResponse()).toBeNull();
    expect(api.reset).toHaveBeenCalledWith('widget-id');
  });

  it('clears a token and reports challenge errors', async () => {
    const api = installApi();
    await state.render(element);
    const options: RenderOptions = api.render.mock.calls[0][1];
    options.callback('token');
    options['error-callback']();
    expect(state.getResponse()).toBeNull();
    expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.error' });
  });

  it('reports render failures without rejecting the render promise', async () => {
    const api = installApi();
    api.render.mockImplementation(() => {
      throw new Error('Invalid site key');
    });
    await expect(state.render(element)).resolves.toBeUndefined();
    expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.error' });
  });

  it('tolerates widgets already removed by Cloudflare', async () => {
    const api = installApi();
    await state.render(element);
    api.remove.mockImplementation(() => {
      throw new Error('Unknown widget');
    });
    expect(() => state.remove()).not.toThrow();
    expect(state.widgetId).toBeUndefined();
  });

  it('drops a submission held while the script loads if the script fails', async () => {
    const submit = vi.fn();
    const pending = state.render(element);
    state.submitWhenReady(submit);
    expect(state.isWaiting()).toBe(true);

    document.querySelector('script')!.dispatchEvent(new Event('error'));
    await pending;

    expect(state.isWaiting()).toBe(false);
    expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.not_loaded_error' });
    expect(submit).not.toHaveBeenCalled();
  });

  describe('held submissions', () => {
    let options: RenderOptions;
    let submit: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const api = installApi();
      await state.render(element);
      options = api.render.mock.calls[0][1];
      submit = vi.fn();
    });

    it('submits straight away when a token is ready', () => {
      options.callback('token');
      state.submitWhenReady(submit);

      expect(submit).toHaveBeenCalledOnce();
      expect(state.isWaiting()).toBe(false);
    });

    it('holds a submission until the token arrives, then sends it once', () => {
      state.submitWhenReady(submit);
      state.submitWhenReady(submit);

      expect(submit).not.toHaveBeenCalled();
      expect(state.isWaiting()).toBe(true);
      expect(state.message).toBe('flectar-turnstile.forum.verifying');

      options.callback('token');

      expect(submit).toHaveBeenCalledOnce();
      expect(callback.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0]);
      expect(state.isWaiting()).toBe(false);
      expect(state.message).toBeNull();
    });

    it('asks for an interactive challenge and continues once it is solved', () => {
      state.submitWhenReady(submit);
      options['before-interactive-callback']();

      expect(state.isWaiting()).toBe(false);
      expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.validation_error' });
      expect(state.message).toBe('flectar-turnstile.forum.validation_error');

      // Solving the challenge takes as long as the visitor needs.
      vi.advanceTimersByTime(60_000);
      expect(errorCallback).toHaveBeenCalledOnce();

      options['after-interactive-callback']();
      expect(state.isWaiting()).toBe(true);
      options.callback('token');

      expect(submit).toHaveBeenCalledOnce();
    });

    it('asks for an interactive challenge that is already showing', () => {
      options['before-interactive-callback']();
      expect(errorCallback).not.toHaveBeenCalled();

      state.submitWhenReady(submit);

      expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.validation_error' });
      expect(state.isWaiting()).toBe(false);

      options.callback('token');
      expect(submit).toHaveBeenCalledOnce();
    });

    it('stops waiting 10 seconds after the first attempt', () => {
      state.submitWhenReady(submit);
      vi.advanceTimersByTime(5_000);
      state.submitWhenReady(submit);
      vi.advanceTimersByTime(4_999);
      expect(errorCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(state.isWaiting()).toBe(false);
      expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.slow_error' });

      options.callback('late-token');
      expect(submit).not.toHaveBeenCalled();
    });

    it('drops a held submission when the widget fails, and reports the failure on the next attempt', () => {
      state.submitWhenReady(submit);
      options['error-callback']();

      expect(state.isWaiting()).toBe(false);
      expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.error' });

      errorCallback.mockClear();
      state.submitWhenReady(submit);

      expect(state.isWaiting()).toBe(false);
      expect(errorCallback).toHaveBeenCalledWith({ type: 'error', content: 'flectar-turnstile.forum.error' });

      options.callback('recovered-token');
      expect(submit).not.toHaveBeenCalled();
    });

    it('drops a held submission when an interactive challenge times out', () => {
      state.submitWhenReady(submit);
      options['before-interactive-callback']();
      options['timeout-callback']();
      options.callback('token');

      expect(submit).not.toHaveBeenCalled();
    });

    it('drops a held submission when the modal closes', () => {
      state.submitWhenReady(submit);
      state.remove();
      options.callback('late-token');
      vi.advanceTimersByTime(10_000);

      expect(submit).not.toHaveBeenCalled();
      expect(errorCallback).not.toHaveBeenCalled();
    });

    it('lets the visitor cancel a held submission', () => {
      expect(state.cancelSubmit()).toBe(false);
      state.submitWhenReady(submit);

      expect(state.cancelSubmit()).toBe(true);
      expect(state.message).toBeNull();

      options.callback('token');
      vi.advanceTimersByTime(10_000);
      expect(submit).not.toHaveBeenCalled();
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });
});
