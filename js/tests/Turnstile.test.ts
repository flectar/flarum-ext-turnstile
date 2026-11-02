import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Turnstile from '../src/forum/components/Turnstile';
import type TurnstileState from '../src/common/states/TurnstileState';

describe('Turnstile widget component', () => {
  let redraw: ReturnType<typeof vi.fn>;
  let state: Pick<TurnstileState, 'render' | 'remove' | 'cancelSubmit' | 'message'>;
  let form: HTMLFormElement;
  let input: HTMLInputElement;
  let vnode: any;
  let component: Turnstile;

  beforeEach(() => {
    redraw = vi.fn();
    vi.stubGlobal(
      'm',
      Object.assign((tag: unknown, attrs: unknown, ...children: unknown[]) => ({ tag, attrs, children }), { redraw })
    );
    state = { render: vi.fn(), remove: vi.fn(), cancelSubmit: vi.fn(() => true), message: null };
    form = document.createElement('form');
    input = document.createElement('input');
    const dom = document.createElement('div');
    dom.innerHTML = '<div class="cf-turnstile"></div>';
    form.append(input, dom);
    document.body.appendChild(form);
    vnode = { attrs: { state }, dom };
    component = new Turnstile();
    component.oninit(vnode);
    component.oncreate(vnode);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders the widget into its container', () => {
    expect(state.render).toHaveBeenCalledWith(vnode.dom.querySelector('.cf-turnstile'), 'light');
  });

  it('cancels a held submission when the visitor edits the form', () => {
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(state.cancelSubmit).toHaveBeenCalledOnce();
    expect(redraw).toHaveBeenCalledOnce();
  });

  it('stops listening to the form once removed', () => {
    component.onremove(vnode);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(state.remove).toHaveBeenCalledOnce();
    expect(state.cancelSubmit).not.toHaveBeenCalled();
  });

  it('announces the latest status to screen readers', () => {
    const status = () => (component.view() as any).children[1];
    expect(status().attrs).toMatchObject({ className: 'visually-hidden', role: 'status' });
    expect(status().children).toEqual([null]);

    state.message = 'flectar-turnstile.forum.verifying';

    expect(status().children).toEqual(['flectar-turnstile.forum.verifying']);
  });
});
