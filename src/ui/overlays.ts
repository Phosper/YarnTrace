import { LEVEL_COUNT, levelArt, levelName } from '../game/registry';
import type { Art } from '../game/types';
import type { Progress } from '../store/progress';
import type { Settings } from '../store/settings';
import { ICON } from './icons';
import { paintArt } from './thumb';

export interface LevelPanelOptions {
  current: number | null;
  progress: Progress;
  onPick: (index: number) => void;
  onRandom: () => void;
  onUpload: (file: File) => void;
}

export interface WinPanelOptions {
  title: string;
  art: Art;
  stars: number;
  ms: number;
  misses: number;
  combo: number;
  /** True when this run beat an earlier clear of the same level. */
  record: boolean;
  animate: boolean;
  onStar: (index: number) => void;
  onAgain: () => void;
  onNext: (() => void) | null;
  onLevels: () => void;
  onShare: () => void;
}

function formatTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const starRow = (count: number): string =>
  [0, 1, 2].map((i) => `<i class="star${i < count ? ' on' : ''}">${ICON.star}</i>`).join('');

export class Overlays {
  private dismissible = false;
  private timers: number[] = [];

  constructor(private root: HTMLElement) {
    root.addEventListener('click', (event) => {
      if (event.target === root && this.dismissible) this.hide();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.dismissible && this.isOpen) this.hide();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  hide(): void {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private mount(html: string, dismissible: boolean): HTMLElement {
    this.hide();
    this.dismissible = dismissible;
    this.root.innerHTML = html;
    this.root.classList.remove('hidden');
    return this.root.firstElementChild as HTMLElement;
  }

  showLevels(opts: LevelPanelOptions): void {
    let cards = '';
    let earned = 0;
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const record = opts.progress[`l${i}`];
      const stars = record?.stars ?? 0;
      earned += stars;
      const cls = `lv${record ? ' done' : ''}${opts.current === i ? ' current' : ''}`;
      cards += `<button class="${cls}" data-level="${i}" title="${levelName(i)}">
        <canvas data-art="${i}"></canvas>
        <span class="lv-num">${i}</span>
        <span class="stars">${starRow(stars)}</span>
      </button>`;
    }

    const panel = this.mount(
      `<div class="panel levels-panel">
        <div class="panel-head">
          <div>
            <h2>选择关卡</h2>
            <p class="sub">不限时，也不会失败 · 已收集 <b>${earned}</b> / ${LEVEL_COUNT * 3} 颗星</p>
          </div>
          <button class="chip small" data-act="close" aria-label="关闭">${ICON.close}</button>
        </div>
        <div class="levels">${cards}</div>
        <div class="actions">
          <button class="btn" data-act="random">${ICON.dice}<span>随机一局</span></button>
          <button class="btn" data-act="upload">${ICON.image}<span>用我的图片</span></button>
        </div>
        <input type="file" accept="image/*" hidden />
      </div>`,
      true,
    );

    panel.querySelectorAll<HTMLCanvasElement>('canvas[data-art]').forEach((canvas) => {
      paintArt(canvas, levelArt(Number(canvas.dataset.art)));
    });
    panel.querySelector('.lv.current')?.scrollIntoView({ block: 'center' });

    const input = panel.querySelector('input[type=file]') as HTMLInputElement;
    panel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const card = target.closest('[data-level]') as HTMLElement | null;
      if (card) {
        this.hide();
        opts.onPick(Number(card.dataset.level));
        return;
      }
      const action = (target.closest('[data-act]') as HTMLElement | null)?.dataset.act;
      if (action === 'close') this.hide();
      if (action === 'random') {
        this.hide();
        opts.onRandom();
      }
      if (action === 'upload') input.click();
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        this.hide();
        opts.onUpload(file);
      }
    });
  }

  showSettings(settings: Settings, onChange: (next: Settings) => void): void {
    const row = (key: keyof Settings, label: string, note: string): string =>
      `<div class="row">
        <div><div>${label}</div><small>${note}</small></div>
        <button class="switch${settings[key] ? ' on' : ''}" data-key="${key}" role="switch" aria-checked="${settings[key]}" aria-label="${label}"></button>
      </div>`;

    const panel = this.mount(
      `<div class="panel">
        <div class="panel-head">
          <div><h2>设置</h2><p class="sub">只影响手感，不影响关卡。</p></div>
          <button class="chip small" data-act="close" aria-label="关闭">${ICON.close}</button>
        </div>
        ${row('sound', '音效', '连续送走毛线，音调会一路升高')}
        ${row('haptics', '震动', '仅在支持震动的手机上生效')}
        ${row('reduceMotion', '减少动画', '去掉滑出、弹回和庆祝动画')}
        <h3>怎么玩</h3>
        <ul class="howto">
          <li>点一条毛线，它会顺着箭头溜出棋盘。</li>
          <li>前面有东西挡着就会弹回来，先把挡路的送走。</li>
          <li>不限时、不会失败；少碰壁能拿到更多星星。</li>
          <li>双指捏合或滚轮缩放，拖动平移。</li>
        </ul>
      </div>`,
      true,
    );

    let current = { ...settings };
    panel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const toggle = target.closest('[data-key]') as HTMLElement | null;
      if (toggle) {
        const key = toggle.dataset.key as keyof Settings;
        current = { ...current, [key]: !current[key] };
        toggle.classList.toggle('on', current[key]);
        toggle.setAttribute('aria-checked', String(current[key]));
        onChange(current);
        return;
      }
      if ((target.closest('[data-act]') as HTMLElement | null)?.dataset.act === 'close') this.hide();
    });
  }

  showWin(opts: WinPanelOptions): void {
    const verdict = opts.misses === 0 ? '完美通关！' : opts.stars === 3 ? '漂亮！' : '完成！';
    const panel = this.mount(
      `<div class="panel win${opts.animate ? ' animate' : ''}">
        <div class="win-art"><canvas></canvas></div>
        <div class="stars big">${starRow(opts.stars)}</div>
        <h2>${verdict}</h2>
        <p class="sub">${opts.title}${opts.record ? ' · <b>新纪录</b>' : ''}</p>
        <div class="stats">
          <div><b>${formatTime(opts.ms)}</b><span>用时</span></div>
          <div><b>${opts.misses}</b><span>碰壁</span></div>
          <div><b>${opts.combo}</b><span>最高连击</span></div>
        </div>
        ${opts.onNext ? `<button class="btn primary wide" data-act="next"><span>下一关</span>${ICON.next}</button>` : ''}
        <div class="actions">
          <button class="btn" data-act="again"><span>再玩一次</span></button>
          <button class="btn" data-act="share">${ICON.share}<span>分享</span></button>
          <button class="btn" data-act="levels"><span>选关</span></button>
        </div>
      </div>`,
      false,
    );

    paintArt(panel.querySelector('canvas') as HTMLCanvasElement, opts.art);

    if (opts.animate) {
      for (let i = 0; i < opts.stars; i++) {
        this.timers.push(window.setTimeout(() => opts.onStar(i), 380 + i * 240));
      }
    }

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
        opts.onLevels();
      } else if (action === 'share') {
        opts.onShare();
      }
    });
  }
}
