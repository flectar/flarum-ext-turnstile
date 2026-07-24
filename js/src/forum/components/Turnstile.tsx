import Component from 'flarum/common/Component';
import type TurnstileState from '../../common/states/TurnstileState';
import type Mithril from 'mithril';

export default class Turnstile extends Component<{ state: TurnstileState }> {
  oncreate(vnode: Mithril.VnodeDOM<{ state: TurnstileState }, this>) {
    super.oncreate(vnode);

    const theme = this.detectTheme();

    this.attrs.state.render(vnode.dom.querySelector('.cf-turnstile'), theme);
  }

  onremove(vnode: Mithril.VnodeDOM<{ state: TurnstileState }, this>) {
    this.attrs.state.remove();

    super.onremove(vnode);
  }

  detectTheme(): 'light' | 'dark' {
    const currentTheme = document.documentElement.dataset.theme || 'light';

    return currentTheme.startsWith('dark') ? 'dark' : 'light';
  }

  view() {
    return (
      <div className="Form-group">
        <div className="cf-turnstile" />
      </div>
    );
  }
}
