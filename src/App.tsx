import { useEffect, useMemo, useState } from 'react';
import Viewer, { type ViewName } from './components/Viewer';
import Profile from './components/Profile';
import { GROUPS, SPECIES } from './data/species';
import type { Species } from './engine/types';
import { isSuperior } from './engine/model';
import { rng } from './engine/math';
/** procedural individual: jitter the measured morphometrics within natural variation */
function individual(sp: Species, seed: number): Species {
  if (seed === 1) return sp;
  const r = rng(seed * 7919);
  const j = (v: number, pct: number) => v * (1 + (r() - 0.5) * 2 * pct);
  return {
    ...sp,
    body: { ...sp.body, D: j(sp.body.D, 0.05), P: j(sp.body.P, 0.06), pD: j(sp.body.pD, 0.03), W: j(sp.body.W, 0.05) },
    // the jaw construction (superior / terminal / inferior) is a species character – it never flips with the jitter
    mouth: { ...sp.mouth, gape: j(sp.mouth.gape, 0.05), angle: sp.mouth.angle + (r() - 0.5) * 4, sup: isSuperior(sp.mouth) },
    eye: { ...sp.eye, d: j(sp.eye.d, 0.06) },
    fins: {
      ...sp.fins,
      dorsal: sp.fins.dorsal?.map((f) => ({ ...f, h: j(f.h, 0.08) })),
      anal: sp.fins.anal?.map((f) => ({ ...f, h: j(f.h, 0.08) })),
      caudal: { ...sp.fins.caudal, span: j(sp.fins.caudal.span, 0.05) },
    },
  };
}
function mouthPosition(sp: Species) {
  const m = sp.mouth;
  if (m.kind === 'tube') return 'Tubular snout (pipette)';
  if (m.kind === 'disc') return 'Jawless oral disc';
  if (m.kind === 'none' || m.gape < 0.004) return sp.plan === 'ray' ? 'Ventral (transverse slit behind the nasal curtain)' : 'Ventral (hidden)';
  if (sp.rostrum?.kind === 'sword') return 'Rostrate (gladius sword)';
  if (sp.rostrum?.kind === 'bill') return 'Rostrate (spear bill)';
  if (sp.rostrum?.kind === 'paddle') return 'Sub-rostral (spatulate paddle)';
  if (sp.rostrum?.kind === 'saw') return 'Inferior (pristid saw)';
  if (sp.body.snout) return /seahorse|seadragon|pipefish/.test(sp.id) ? 'Terminal (pipette snout)' : 'Terminal (forceps snout)';
  if (m.s > 0.02 && m.y < -0.5) return 'Inferior (ventral)';
  if (isSuperior(m)) return 'Superior (upturned)';
  if (m.y < -0.15 || m.s > 0.005) return 'Sub-terminal';
  return 'Terminal';
}
const VIEWS: [ViewName, string][] = [['side', 'Lateral'], ['three', '¾'], ['front', 'Mouth'], ['top', 'Dorsal'], ['below', 'Ventral']];
/** Reference photographs live in the fish-images library (github.com/youssef22karam/fish-images) */
const REPO = 'youssef22karam/fish-images';
function photoUrls(id: string, thumb: boolean) {
  const path = `${id}/01_${id}.jpg`;
  const cdn = `https://cdn.jsdelivr.net/gh/${REPO}@main/${path}`;
  const raw = `https://raw.githubusercontent.com/${REPO}/main/${path}`;
  return thumb
    ? [`https://wsrv.nl/?url=${encodeURIComponent(cdn)}&w=120&h=84&fit=cover&output=webp`, cdn, raw]
    : [cdn, raw, `https://wsrv.nl/?url=${encodeURIComponent(raw)}&w=1000`];
}
function RefImg({ id, thumb, className, alt }: { id: string; thumb?: boolean; className: string; alt?: string }) {
  const urls = photoUrls(id, !!thumb);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [id]);
  if (i >= urls.length) return <div className={`${className} grid place-items-center text-[10px] text-slate-500`}>{thumb ? '—' : 'photo unavailable'}</div>;
  return <img key={urls[i]} src={urls[i]} loading="lazy" alt={alt ?? ''} className={className} onError={() => setI((k) => k + 1)} />;
}
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const qn = (k: string, d: number) => (QS.has(k) ? +QS.get(k)! : d);
/** ?ui=0 shows the bare viewport (clean captures) */
const UI = qn('ui', 1) > 0;
export default function App() {
  const [id, setId] = useState(QS.get('sp') ?? 'guppy');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('All');
  const [seed, setSeed] = useState(qn('seed', 1));
  const [gape, setGape] = useState(qn('gape', 0));
  const [autoFeed, setAutoFeed] = useState(qn('feed', 1) > 0);
  const [swim, setSwim] = useState(qn('swim', 1) > 0);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<ViewName>((QS.get('view') as ViewName) ?? 'three');
  const [viewNonce, setViewNonce] = useState(0);
  const [wire, setWire] = useState(qn('wire', 0) > 0);
  const [panel, setPanel] = useState(UI && qn('panel', 1) > 0);
  const [list, setList] = useState(UI && qn('list', 1) > 0);
  const [fins, setFins] = useState(qn('fins', 1) > 0);
  const [eyes, setEyes] = useState(qn('eyes', 1) > 0);
  const [breathe, setBreathe] = useState(qn('breathe', 1) > 0);
  const base = SPECIES.find((s) => s.id === id) ?? SPECIES[0];
  const sp = useMemo(() => individual(base, seed), [base, seed]);
  const filtered = SPECIES.filter((s) => (group === 'All' || s.group === group) && (s.name + s.sci).toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const i = SPECIES.findIndex((s) => s.id === id);
      if (e.key === 'ArrowDown' || e.key === 'j') setId(SPECIES[(i + 1) % SPECIES.length].id);
      if (e.key === 'ArrowUp' || e.key === 'k') setId(SPECIES[(i - 1 + SPECIES.length) % SPECIES.length].id);
      if (e.key === ' ') { e.preventDefault(); setAutoFeed((v) => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [id]);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const hasMouth = sp.mouth.gape > 0.004;
  const stats: [string, string][] = [
    ['Body depth', `${pct(sp.body.D)} SL`],
    ['Head length', `${pct(sp.HL)} SL`],
    ['Peduncle depth', `${pct(sp.body.P)} SL`],
    ['Eye diameter', sp.eye.d > 0 ? `${pct(sp.eye.d)} SL` : 'blind'],
    ['Mouth position', mouthPosition(sp)],
    ['Gape (tip→rictus)', hasMouth ? `${pct(sp.mouth.gape)} SL` : '—'],
    ['Cleft angle', hasMouth ? `${sp.mouth.angle.toFixed(0)}°` : '—'],
    ['Max jaw opening', hasMouth ? `${sp.mouth.open}°` : '—'],
    ['Lower-jaw protrusion', sp.mouth.jut > 0 ? `${pct(sp.mouth.jut)} SL` : 'none'],
    ['Lip / jaw plasticity', hasMouth ? `lip ${Math.round(sp.mouth.lip * 100)}%${(sp.mouth.protrude ?? 0) >= 0.4 ? ' · protrusible' : ''}` : '—'],
    ['Dentition', sp.mouth.teeth],
    ['Caudal fin', sp.fins.caudal.type],
    ['Scales (lat. line)', sp.skin.scales > 0 ? `${sp.skin.scales} · ${sp.skin.kind}` : sp.skin.kind],
    ['Adult length', sp.lenM >= 1 ? `${sp.lenM} m` : `${Math.round(sp.lenM * 100)} cm`],
  ];
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#06121b] text-slate-200 flex font-sans select-none">
      {/* species list */}
      <aside className={`${list ? 'w-72' : 'w-0'} transition-all duration-300 shrink-0 border-r border-cyan-900/40 bg-[#081822]/95 flex flex-col overflow-hidden z-20`}>
        <div className="p-4 pb-2">
          <h1 className="text-lg font-semibold tracking-tight text-cyan-100">Ichthyo<span className="text-cyan-400">Morph</span></h1>
          <p className="text-[11px] text-cyan-200/50 leading-snug mt-0.5">Procedural fishes measured from {SPECIES.length} reference photographs · fish-images library</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search species…" className="mt-3 w-full rounded-lg bg-[#0d2433] border border-cyan-900/50 px-3 py-1.5 text-sm outline-none focus:border-cyan-500/70 placeholder:text-slate-500" />
          <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
            {['All', ...GROUPS].map((g) => (
              <button key={g} onClick={() => setGroup(g)} className={`text-[10px] px-2 py-0.5 rounded-full border ${group === g ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100' : 'border-cyan-900/50 text-slate-400 hover:text-slate-200'}`}>{g}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filtered.map((s) => (
            <button key={s.id} onClick={() => { setId(s.id); setSeed(1); }} className={`w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg mb-0.5 ${s.id === id ? 'bg-cyan-500/15 ring-1 ring-cyan-400/40' : 'hover:bg-white/5'}`}>
              <RefImg id={s.id} thumb className="w-11 h-8 rounded object-cover bg-slate-800 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[13px] truncate text-slate-100">{s.name}</span>
                <span className="block text-[10.5px] italic truncate text-slate-400">{s.sci}</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-slate-500 px-2 py-4">No species match.</p>}
        </div>
      </aside>
      {/* viewport */}
      <main className="relative flex-1 min-w-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#14425a_0%,#0a1d2b_55%,#050d14_100%)]" />
        <Viewer species={sp} seed={seed} gape={gape} autoFeed={autoFeed} swim={swim} speed={speed} view={view} viewNonce={viewNonce} wire={wire} fins={fins} eyes={eyes} breathe={breathe} />
        {/* lens vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(1,8,14,0.5)_100%)]" />
        {UI && (
          <>
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3 pointer-events-none">
              <div className="pointer-events-auto flex gap-2">
                <button onClick={() => setList((v) => !v)} className="btn">{list ? '⟨' : '☰'}</button>
                <div className="glass px-4 py-2">
                  <div className="text-xl font-semibold text-white leading-tight">{sp.name}</div>
                  <div className="text-xs italic text-cyan-200/70">{sp.sci} · {sp.group}</div>
                </div>
              </div>
              <div className="pointer-events-auto flex gap-1 glass p-1">
                {VIEWS.map(([v, l]) => (
                  <button key={v} onClick={() => { setView(v); setViewNonce((n) => n + 1); }} className={`text-xs px-2.5 py-1 rounded-md ${view === v ? 'bg-cyan-400/25 text-white' : 'text-slate-300 hover:bg-white/10'}`}>{l}</button>
                ))}
                <button onClick={() => setPanel((v) => !v)} className="text-xs px-2.5 py-1 rounded-md text-slate-300 hover:bg-white/10">{panel ? 'Hide data ⟩' : '⟨ Data'}</button>
              </div>
            </div>
            {/* controls */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 justify-center max-w-[96%]">
              <label className="flex items-center gap-2 text-xs">
                <span className="text-slate-300">Jaw</span>
                <input type="range" min={0} max={1} step={0.01} value={gape} onChange={(e) => setGape(+e.target.value)} className="w-28 accent-rose-400" />
                <span className="w-8 tabular-nums text-rose-200">{Math.round(gape * sp.mouth.open)}°</span>
              </label>
              <Toggle on={autoFeed} set={setAutoFeed} label="Feeding strike" />
              <Toggle on={breathe} set={setBreathe} label="Breathing" />
              <Toggle on={swim} set={setSwim} label="Swim" />
              <Toggle on={fins} set={setFins} label="Fin motion" />
              <Toggle on={eyes} set={setEyes} label="Eye tracking" />
              <label className="flex items-center gap-2 text-xs">
                <span className="text-slate-300">Speed</span>
                <input type="range" min={0.1} max={2.5} step={0.05} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-20 accent-cyan-400" />
              </label>
              <button onClick={() => setSeed(Math.floor(Math.random() * 1e6) + 2)} className="text-xs px-3 py-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40">🎲 New individual</button>
              {seed !== 1 && <button onClick={() => setSeed(1)} className="text-xs text-slate-400 hover:text-white">reset</button>}
              <Toggle on={wire} set={setWire} label="Mesh" />
            </div>
            <div className="absolute bottom-16 left-3 text-[10px] text-slate-500 hidden md:block">drag to orbit · scroll to zoom · ↑/↓ species · space toggles feeding</div>
          </>
        )}
      </main>
      {/* data panel */}
      <aside className={`${panel ? 'w-[370px]' : 'w-0'} transition-all duration-300 shrink-0 border-l border-cyan-900/40 bg-[#081822]/95 overflow-hidden z-20`}>
        <div className="w-[370px] h-full overflow-y-auto p-4 space-y-4">
          <section>
            <h2 className="label">Reference photograph</h2>
            <div className="rounded-xl overflow-hidden border border-cyan-900/50 bg-black">
              <a href={`https://github.com/${REPO}/tree/main/${sp.id}`} target="_blank" rel="noreferrer" title="Open in the fish-images library"><RefImg id={sp.id} alt={sp.name} className="w-full max-h-60 min-h-24 object-contain" /></a>
            </div>
          </section>
          <section>
            <h2 className="label">Measured lateral profile → generator input</h2>
            <div className="rounded-xl overflow-hidden border border-cyan-900/50 bg-[#0a1f2c] p-1">
              <Profile sp={sp} />
            </div>
            <div className="flex gap-3 text-[10px] text-slate-400 mt-1.5">
              <span><i className="inline-block w-3 h-0.5 bg-rose-400 align-middle mr-1" />oral cleft</span>
              <span><i className="inline-block w-2 h-2 rounded-full bg-rose-400 align-middle mr-1" />rictus</span>
              <span><i className="inline-block w-2 h-2 rounded-full border border-amber-300 align-middle mr-1" />jaw hinge</span>
              <span><i className="inline-block w-3 border-t border-dashed border-cyan-300 align-middle mr-1" />opercle</span>
            </div>
          </section>
          <section>
            <h2 className="label">Morphometrics</h2>
            <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden border border-cyan-900/50 bg-cyan-900/30">
              {stats.map(([k, v]) => (
                <div key={k} className="bg-[#0a1f2c] px-3 py-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
                  <div className="text-[13px] text-cyan-50 capitalize">{v}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="label">Read off the photograph</h2>
            <p className="text-[12.5px] leading-relaxed text-slate-300">{sp.note}</p>
          </section>
          <section className="text-[11px] text-slate-500 leading-relaxed pb-4">
            Each fish is lofted from analytic outline curves (depth, max-depth position, snout bluntness, peduncle) and split along the measured oral cleft – terminal, inferior (arched across the underside of the snout) or superior (starting on the dorsal profile, the chin forming the tip of the head). The mandible is skinned as a wedge about the quadrate joint, so a 3 %-SL parrotfish beak and a bass's bucket mouth both open cleanly. Lips are folds of the head skin that meet in one crease; beaks are paired dental plates with an overbite. Eyes are organs, not decals: a globe that turns in its socket, the spherical lens standing in the pupil of a guanine-mirrored, melanophore-stippled iris under a clear cornea – flush in tunas, domed in most fishes, raised on periscope turrets in mudskippers – with pupils that are round, pear-shaped, slit or crescent as in the living animal. The integument is evaluated per pixel – imbricated scales with true relief, per-scale glitter and iridescence, melanophores, lateral-line pores – and the gills breathe: each gill cover is a free flap over a real gill chamber, lifting off the shoulder girdle to show the blood-red filament combs of the gill arches (five flapped slits in sharks, a pore in morays and seahorses), always in front of the pectoral fin, under the caustics of the water surface.
          </section>
        </div>
      </aside>
    </div>
  );
}
function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => set(!on)} className="flex items-center gap-1.5 text-xs text-slate-300">
      <span className={`w-7 h-4 rounded-full relative transition ${on ? 'bg-cyan-500/70' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}
