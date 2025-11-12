import Component from 'flarum/common/Component';

export default class Turnstile extends Component<{ state: any }> {
  oncreate(vnode) {
    super.oncreate(vnode);

    const theme = this.detectTheme();

    this.attrs.state.render(vnode.dom.querySelector('.cf-turnstile'), theme);
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
