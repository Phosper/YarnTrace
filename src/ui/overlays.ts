import { LEVEL_COUNT } from '../game/registry';
import type { Settings } from '../store/settings';
import type { Progress } from '../store/progress';

export interface LevelPanelOptions {
  current: number | null;
  cleared: Progress;
  onPick: (index: number) => void;
  onRandom: () => void;
  onUpload: (file: File) => void;
}

export interface WinPanelOptions {
  name: string;
  moves: number;
  ms: number;
  onAgain: () => void;
  onNext: (() => void) | null;
  onLevels: () => void;
}

function formatTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Overlays {
  constructor(private root: HTMLElement) {}

  hide(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private mount(html: string): HTMLElement {
    this.root.innerHTML = html;
    this.root.classList.remove('hidden');
    return this.root.firstElementChild as HTMLElement;
  }

  showLevels(opts: LevelPanelOptions): void {
    let buttons = '';
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const done = opts.cleared[`l${i}`];
      const cls = `icon${done ? ' cleared' : ''}${opts.current === i ? ' current' : ''}`;
      buttons += `<button class="${cls}" data-level="${i}">${i}${done ? '<span class="dot"></span>' : ''}</button>`;
    }

    const panel = this.mount(`
      <div class="panel">
        <h2>选择关卡</h2>
        <p class="sub">没有时间、没有生命，想玩多久就玩多久。</p>
        <div class="levels">${buttons}</div>
        <div class="actions">
          <button class="icon" data-act="random">随机图案</button>
          <button class="icon" data-act="upload">上传图片</button>
          <button class="icon" data-act="close">关闭</button>
        </div>
        <input type="file" accept="image/*" style="display:none" />
      </div>
    `);

    panel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const levelButton = target.closest('[data-level]') as HTMLElement | null;
      if (levelButton) {
        this.hide();
        opts.onPick(Number(levelButton.dataset.level));
        return;
      }
      const action = (target.closest('[data-act]') as HTMLElement | null)?.dataset.act;
      if (action === 'close') this.hide();
      if (action === 'random') {
        this.hide();
        opts.onRandom();
      }
      if (action === 'upload') {
        const input = panel.querySelector('input[type=file]') as HTMLInputElement;
        input.click();
      }
    });

    const input = panel.querySelector('input[type=file]') as HTMLInputElement;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        this.hide();
        opts.onUpload(file);
      }
    });
  }

  showSettings(settings: Settings, onChange: (next: Settings) => void): void {
    const panel = this.mount(`
      <div class="panel">
        <h2>设置</h2>
        <p class="sub">只影响手感，不影响关卡。</p>
        <div class="row">
          <span>辅助线（显示每个团的边界）</span>
          <button class="switch${settings.guides ? ' on' : ''}" data-key="guides"></button>
        </div>
        <div class="row">
          <span>减少动画</span>
          <button class="switch${settings.reduceMotion ? ' on' : ''}" data-key="reduceMotion"></button>
        </div>
        <div class="actions">
          <button class="icon primary" data-act="close">完成</button>
        </div>
      </div>
    `);

    let current = { ...settings };

    panel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const toggle = target.closest('[data-key]') as HTMLElement | null;
      if (toggle) {
        const key = toggle.dataset.key as keyof Settings;
        current = { ...current, [key]: !current[key] };
        toggle.classList.toggle('on', current[key]);
        onChange(current);
        return;
      }
      if ((target.closest('[data-act]') as HTMLElement | null)?.dataset.act === 'close') {
        this.hide();
      }
    });
  }

  showWin(opts: WinPanelOptions): void {
    const panel = this.mount(`
      <div class="panel">
        <h2>清空完成</h2>
        <p class="sub">${opts.name}</p>
        <div class="stats">
          <div><b>${opts.moves}</b><span>步数</span></div>
          <div><b>${formatTime(opts.ms)}</b><span>用时</span></div>
        </div>
        <div class="actions">
          <button class="icon" data-act="again">再来一次</button>
          ${opts.onNext ? '<button class="icon primary" data-act="next">下一关</button>' : ''}
          <button class="icon" data-act="levels">选关</button>
        </div>
      </div>
    `);

    panel.addEventListener('click', (event) => {
      const action = ((event.target as HTMLElement).closest('[data-act]') as HTMLElement | null)
        ?.dataset.act;
      if (action === 'again') {
        this.hide();
        opts.onAgain();
      } else if (action === 'next' && opts.onNext) {
        this.hide();
        opts.onNext();
      } else if (action === 'levels') {
        this.hide();
        opts.onLevels();
      }
    });
  }
}
