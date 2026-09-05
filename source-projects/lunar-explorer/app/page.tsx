'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Crosshair, Expand, HelpCircle, Maximize2, Minus, Move, Orbit, Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Explorer, Telemetry, ViewMode } from './scene';

export default function Home() {
  const viewport = useRef<HTMLDivElement>(null);
  const engine = useRef<Explorer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<ViewMode>('follow');
  const [speed, setSpeed] = useState(1);
  const [help, setHelp] = useState(false);
  const [clean, setClean] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry>({ distance: 0, speed: .12, heading: 0, slope: 0 });

  useEffect(() => {
    let cancelled = false;
    import('./scene').then(({ createExplorer }) => {
      if (cancelled || !viewport.current) return;
      engine.current = createExplorer(viewport.current, setTelemetry);
      setReady(true);
    }).catch((e) => {
      console.error(e);
      setError('3D 场景无法启动，请开启浏览器硬件加速后刷新页面。');
    });
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null; };
  }, []);

  function togglePlay() {
    setPlaying(p => { engine.current?.setPlaying(!p); return !p; });
  }
  function changeMode(value: ViewMode) { setMode(value); engine.current?.setMode(value); }
  function cycleSpeed() { const next = speed === 1 ? 2 : speed === 2 ? .5 : 1; setSpeed(next); engine.current?.setSpeed(next); }
  function reset() { engine.current?.resetView(); setMode('follow'); }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setClean(p => !p); }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('button, input, [role="dialog"]')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyH') setClean(p => !p);
      if (e.code === 'KeyR') reset();
      if (e.code === 'Escape') { setHelp(false); setClean(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className={`explorer ${clean ? 'is-clean' : ''}`}>
      <div className="viewport" ref={viewport} aria-label="可交互的三维月面探测车场景" />
      <div className="vignette" />
      <header className="site-header interface">
        <div className="brand"><Orbit size={31} strokeWidth={1.25} /><span>SELENE<span className="brand-studio">LUNAR EXPLORER</span></span></div>
        <div className="header-center"><span className="live-dot" />实时月面探索<span className="header-divider" />3D SIMULATION</div>
        <div className="header-actions"><button onClick={() => setHelp(true)} className="icon-button" aria-label="操作指南" title="操作指南"><HelpCircle size={19} /></button><button onClick={fullscreen} className="icon-button" aria-label="全屏浏览" title="全屏浏览"><Expand size={19} /></button></div>
      </header>

      <section className="intro interface">
        <div className="eyebrow"><span className="small-line" />EXPEDITION 001</div>
        <h1>月面漫游<span className="title-dot">.</span></h1>
        <p>跟随玉衡号，探索三维月面。</p>
        <div className="location"><span className="location-cross">+</span>静海边缘<span className="text-divider">/</span>模拟探索区域</div>
      </section>

      <aside className="environment interface" aria-label="环境信息">
        <span className="eyebrow">LUNAR ENVIRONMENT</span>
        <div className="environment-line"><span>重力加速度</span><strong>1.62 <small>m/s²</small></strong></div>
        <div className="environment-line"><span>环境</span><strong>真空<span className="tiny-dot" /></strong></div>
        <div className="environment-line"><span>光照</span><strong>太阳直射</strong></div>
        <div className="environment-foot">月面地形与行驶数据为模拟</div>
      </aside>

      <div className="view-tools interface" aria-label="视角控制">
        <button className="icon-button" onClick={() => engine.current?.zoom(-1)} title="拉近" aria-label="拉近"><Plus size={19} /></button>
        <span />
        <button className="icon-button" onClick={() => engine.current?.zoom(1)} title="拉远" aria-label="拉远"><Minus size={19} /></button>
        <span />
        <button className="icon-button" onClick={reset} title="重置视角 · R" aria-label="重置视角"><RotateCcw size={17} /></button>
        <span />
        <button className="icon-button" onClick={() => setClean(true)} title="纯净视图 · H" aria-label="纯净视图"><Maximize2 size={17} /></button>
      </div>

      <section className="rover-card interface" aria-label="探测车实时数据">
        <div className="rover-name"><span className="vehicle-index">01</span><div><span className="eyebrow">SELENE · 玉衡号</span><h2>月面探测车 <ArrowUpRight size={17} /></h2></div></div>
        <div className="vehicle-status"><span className={`live-dot ${playing ? '' : 'paused'}`} />{playing ? '正在探索月面' : '已暂停行驶'}<span className="status-line" />六轮独立驱动</div>
        <div className="telemetry-grid">
          <div><span>行驶速度</span><strong>{(playing ? telemetry.speed : 0).toFixed(2)}<small>m/s</small></strong></div>
          <div><span>探索里程</span><strong>{telemetry.distance.toFixed(1)}<small>m</small></strong></div>
          <div><span>当前坡度</span><strong>{telemetry.slope.toFixed(1)}<small>°</small></strong></div>
        </div>
      </section>

      <div className="compass interface" aria-label={`探测车航向 ${telemetry.heading.toFixed(0)} 度`}>
        <div className="compass-dial"><span className="north">N</span><span className="east">E</span><span className="west">W</span><span className="south">S</span><div className="compass-pointer" style={{ transform: `rotate(${telemetry.heading}deg)` }}><i /></div><b /></div>
        <span className="compass-caption">航向 {String(Math.round(telemetry.heading)).padStart(3, '0')}°</span>
      </div>

      <div className="bottom-dock interface">
        <div className="playback"><button className="play-button" onClick={togglePlay} disabled={!ready} aria-label={playing ? '暂停行驶' : '继续行驶'} title="播放 / 暂停 · 空格">{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><span>{playing ? '自动巡航' : '巡航暂停'}</span><button className="speed-button" onClick={cycleSpeed} aria-label={`行驶倍率 ${speed} 倍，点击切换`}>{speed.toFixed(1)}×</button></div>
        <span className="dock-divider" />
        <div className="view-modes" aria-label="浏览模式">
          <button className={mode === 'follow' ? 'active' : ''} onClick={() => changeMode('follow')} aria-pressed={mode === 'follow'}><Crosshair size={16} /><span>跟随视角</span></button>
          <button className={mode === 'free' ? 'active' : ''} onClick={() => changeMode('free')} aria-pressed={mode === 'free'}><Move size={16} /><span>自由探索</span></button>
        </div>
      </div>
      <footer className="footer interface"><span><i />{ready ? '场景运行中' : '准备场景'}<span className="text-divider">/</span>交互式 3D 体验</span><span className="interaction-tip">拖动旋转<span>·</span>滚轮缩放<span>·</span>右键平移{mode === 'free' && <><span>·</span>WASD 移动 / QE 升降</>}</span><span>SELENE / MISSION 001</span></footer>
      {clean && <button className="restore-ui" onClick={() => setClean(false)}><Maximize2 size={15} />显示界面 <kbd>H</kbd></button>}
      {!ready && <div className="loading-screen"><Orbit size={45} strokeWidth={1} /><div>{error || '正在抵达月球表面'}</div>{!error && <span>构建地形 · 装配探测车 · 校准光照</span>}{error && <button onClick={() => window.location.reload()}>重新加载</button>}</div>}
      <Dialog open={help} onOpenChange={setHelp}><DialogContent className="help-panel" showCloseButton={false}><button className="close-help icon-button" aria-label="关闭操作指南" onClick={() => setHelp(false)}><X size={20} /></button><span className="eyebrow">EXPLORER GUIDE</span><DialogTitle>以你的视角，探索月球。</DialogTitle><dl><div><dt>旋转观察</dt><dd>鼠标左键拖动 / 单指拖动</dd></div><div><dt>拉近与拉远</dt><dd>滚动鼠标滚轮 / 双指捏合</dd></div><div><dt>平移视角</dt><dd>鼠标右键拖动 / 双指拖动</dd></div><div><dt>自由飞行</dt><dd>自由探索模式下 WASD 移动，QE 升降</dd></div><div><dt>暂停 / 继续</dt><dd><kbd>Space</kbd></dd></div><div><dt>重置视角 / 隐藏界面</dt><dd><kbd>R</kbd> / <kbd>H</kbd></dd></div></dl><DialogDescription>跟随视角让探测车始终与你同行；切换自由探索，可离开探测车独立浏览立体月面。</DialogDescription></DialogContent></Dialog>
    </main>
  );
}
