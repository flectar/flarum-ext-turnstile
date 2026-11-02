import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type TurnstileState from '../../common/states/TurnstileState';
import type Mithril from 'mithril';

export default class Turnstile extends Component<{ state: TurnstileState }> {
  form: HTMLFormElement | null = null;

  oncreate(vnode: Mithril.VnodeDOM<{ state: TurnstileState }, this>) {
    super.oncreate(vnode);

    const theme = this.detectTheme();

    this.form = vnode.dom.closest('form');
    this.form?.addEventListener('input', this.cancelHeldSubmit);
    this.attrs.state.render(vnode.dom.querySelector('.cf-turnstile'), theme);
  }

  onremove(vnode: Mithril.VnodeDOM<{ state: TurnstileState }, this>) {
    this.form?.removeEventListener('input', this.cancelHeldSubmit);
    this.attrs.state.remove();

    super.onremove(vnode);
  }

  // Editing changes what a held submission would send, so let the visitor submit again when ready.
  cancelHeldSubmit = () => {
    if (this.attrs.state.cancelSubmit()) m.redraw();
  };

  detectTheme(): 'light' | 'dark' {
    const currentTheme = document.documentElement.dataset.theme || 'light';

    return currentTheme.startsWith('dark') ? 'dark' : 'light';
  }

  view() {
    const { message } = this.attrs.state;

    return (
      <div className="Form-group">
        <div className="cf-turnstile" />
        <div className="visually-hidden" role="status">
          {message && app.translator.trans(message)}
        </div>
      </div>
    );
  }
}
