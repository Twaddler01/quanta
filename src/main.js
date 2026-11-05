import { el, div, span, on } from "./dom.js";

/* =========================================================================
   QUANTA — prototype incremental
   -------------------------------------------------------------------------
   NEW in this revision:
     • CONSUME QUANTA → Quantum Surge: a temporary QPS multiplier that
       follows a log curve and decays exponentially.
     • Vacuum Collector base raised 0.4 → 1.0 Q/s so passive is viable.
     • Formula panel shows surge contribution when active.
     • HUD gains a SURGE pill.
   ========================================================================= */


/* =========================================================================
   Format
   ========================================================================= */
const Format = (() => {
  const SUFFIX = ['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc',
                  'UDc','DDc','TDc','QaDc','QiDc','SxDc','SpDc','OcDc','NoDc',
                  'Vg','UVg','DVg','TVg','QaVg','QiVg','SxVg','SpVg','OcVg','NoVg'];

  function num(n){
    if (!isFinite(n)) return n > 0 ? '∞' : '−∞';
    if (n < 0) return '−' + num(-n);
    if (n === 0) return '0';
    if (n < 0.01) return n.toExponential(2);
    if (n < 10) return n.toFixed(2);
    if (n < 100) return n.toFixed(1);
    if (n < 1000) return Math.floor(n).toString();

    const tier = Math.floor(Math.log10(n) / 3);
    if (tier < SUFFIX.length){
      const s = n / Math.pow(1000, tier);
      const d = s < 10 ? 2 : s < 100 ? 1 : 0;
      return s.toFixed(d) + SUFFIX[tier];
    }
    const e = Math.floor(Math.log10(n));
    return (n / Math.pow(10, e)).toFixed(2) + 'e' + e;
  }

  function time(sec){
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  }

  function plain(v){
    const r = Math.round(v * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  }

  return { num, time, plain };
})();


/* =========================================================================
   WaveFloor
   ========================================================================= */
const WaveFloor = {
  at(lv){
    return Math.min(Config.WAVE.floorMax, Config.WAVE.floorStep * lv);
  }
};


/* =========================================================================
   Config
   ========================================================================= */
const Config = (() => {

  const SAVE_KEY        = 'quanta_save_v3';
  const RESONANCE_BASE  = 1.25;
  const PHASE_BASE      = 1.15;
  const COHERENCE_BASE  = 1.80;
  const OFFLINE_CAP     = 8 * 3600;

  /* --- Collector base bumped to 1.0 so passive matches tap per level --- */
  const UPGRADES = [
    { id:'observer', name:'Observer Precision',
      flavor:'Sharper measurement collapses the wavefunction into more quanta.',
      cost:   lv => 10 * Math.pow(1.55, lv),
      effect: lv => '+' + lv + ' base observation yield' },
    { id:'collector', name:'Vacuum Collector',
      flavor:'Drone lattices siphon zero-point fluctuations automatically.',
      cost:   lv => 25 * Math.pow(1.62, lv),
      effect: lv => '+' + Format.num(1.0 * lv) + ' Q/s' },   // was 0.4
    { id:'resonance', name:'Resonance Cascade',
      flavor:'Constructive interference amplifies every measurement channel.',
      cost:   lv => 400 * Math.pow(4.2, lv),
      effect: lv => '×' + Format.num(Math.pow(RESONANCE_BASE, lv)) + ' to ALL gains' },
    { id:'buffer', name:'Saturation Buffer',
      flavor:'Widens the flux ceiling. Past the cap, output compresses as a power law.',
      cost:   lv => 2000 * Math.pow(8, lv),
      effect: lv => 'softcap threshold ×' + Format.num(Math.pow(2.5, lv)) }
  ];

  const MODIFIERS = [
    { id:'psi', sym:'Ψ', name:'Wavefunction Weight', weight:0.10, target:'tap',
      flavor:'Adds 10% of base per level to observation yield.',
      cost: lv => 40 * Math.pow(2.35, lv) },
    { id:'phi', sym:'Φ', name:'Entanglement Weight', weight:0.12, target:'auto',
      flavor:'Adds 12% of base per level to automatic yield.',
      cost: lv => 70 * Math.pow(2.35, lv) },
    { id:'lam', sym:'Λ', name:'Cosmological Weight', weight:0.06, target:'all',
      flavor:'Adds 6% of base per level to every channel.',
      cost: lv => 300 * Math.pow(3.1, lv) }
  ];

  const PHASE_UPGRADES = [
    { id:'stab', name:'Stabilizer',
      flavor:'Pins the coherence wave upward. Raises the trough of the oscillation.',
      cost:   lv => 4 * Math.pow(1.9, lv),
      effect: lv => 'wave floor ' + Format.plain(WaveFloor.at(lv)) +
                    ' → ' + Format.plain(WaveFloor.at(lv + 1)) },
    { id:'harm', name:'Harmonic Amplifier',
      flavor:'Resonant cavities stack the collapsed amplitude.',
      cost:   lv => 12 * Math.pow(2.1, lv),
      effect: lv => '×' + Format.num(Math.pow(COHERENCE_BASE, lv)) + ' coherence per collapse' },
    { id:'lock', name:'Phase Lock',
      flavor:'Locked coherence bleeds back into ordinary quanta production.',
      cost:   lv => 30 * Math.pow(2.4, lv),
      effect: lv => '×' + Format.num(Math.pow(PHASE_BASE, lv)) + ' to ALL quanta gains' }
  ];

  const SOFTCAP = {
    tap:  { base: 250, pow: 0.72 },
    auto: { base: 150, pow: 0.70 }
  };
  const BUFFER_MULT = 2.5;

  const WAVE = {
    speed: 1.55,
    a1:    0.30,
    a2:    0.11,
    a3:    0.06,
    span:  3.2,
    floorStep: 0.08,
    floorMax:  0.80
  };

  /* --- NEW: Quantum Surge tuning knobs --- */
  const SURGE = {
    costPct:         0.20,   // spend 20% of holdings per press
    minCost:         10,     // never below this
    referenceFactor: 0.02,   // cost/reference = factor * sqrt(quanta)
    minReference:    10,
    decay:           0.10,   // 10% loss per second
    coefficient:     2.5     // multiplier = 1 + coef * log10(1 + surge)
  };

  return {
    SAVE_KEY, RESONANCE_BASE, PHASE_BASE, COHERENCE_BASE, OFFLINE_CAP,
    UPGRADES, MODIFIERS, PHASE_UPGRADES, SOFTCAP, BUFFER_MULT, WAVE, SURGE
  };
})();


/* =========================================================================
   State
   ========================================================================= */
const State = (() => {
  function blank(){
    return {
      quanta: 0, total: 0, taps: 0,
      coherence: 0, collapses: 0,
      surge: 0,                                   // NEW
      start: Date.now(), lastSave: Date.now(),
      up:  { observer: 0, collector: 0, resonance: 0, buffer: 0 },
      mod: { psi: 0, phi: 0, lam: 0 },
      cUp: { stab: 0, harm: 0, lock: 0 }
    };
  }
  let s = blank();
  return {
    get: () => s,
    blank,
    replace(next){ s = next; return s; }
  };
})();


/* =========================================================================
   Wave
   ========================================================================= */
const Wave = (() => {
  const W = Config.WAVE;

  function raw(t){
    return 0.5
      + W.a1 * Math.sin(t * W.speed)
      + W.a2 * Math.sin(t * W.speed * 2.7 + 1.3)
      + W.a3 * Math.sin(t * W.speed * 4.3 + 2.1);
  }

  const floor = () => WaveFloor.at(State.get().cUp.stab);

  function value(t){
    const f = floor();
    const r = Math.min(1, Math.max(0, raw(t)));
    return f + (1 - f) * r;
  }

  const quality = t => 0.1 + 0.9 * value(t);

  return { raw, floor, value, quality };
})();


/* =========================================================================
   Calc
   ========================================================================= */
const Calc = (() => {

  function softcapThreshold(kind){
    return Config.SOFTCAP[kind].base * Math.pow(Config.BUFFER_MULT, State.get().up.buffer);
  }

  function softcap(v, kind){
    const b = softcapThreshold(kind);
    if (v <= b) return v;
    return b * Math.pow(v / b, Config.SOFTCAP[kind].pow);
  }

  function channelMult(target){
    let m = 1;
    for (const mod of Config.MODIFIERS){
      if (mod.target === target || mod.target === 'all'){
        m *= 1 + mod.weight * (State.get().mod[mod.id] || 0);
      }
    }
    return m;
  }

  function globalMult(){
    const s = State.get();
    return Math.pow(Config.RESONANCE_BASE, s.up.resonance)
         * Math.pow(Config.PHASE_BASE,     s.cUp.lock);
  }

  const rawTap  = () => (1 + State.get().up.observer) * channelMult('tap')  * globalMult();
  const tapGain = () => softcap(rawTap(), 'tap');

  /* Collector base raised to 1.0 */
  const rawAuto = () => 1.0 * State.get().up.collector * channelMult('auto') * globalMult();
  const qps     = () => softcap(rawAuto(), 'auto');

  const coherenceBase = () => Math.pow(Config.COHERENCE_BASE, State.get().cUp.harm);
  const coherenceGain = t => coherenceBase() * Wave.quality(t);
  const collapseCost  = () => 25 * Math.pow(1.35, State.get().collapses);

  /* --- NEW: surge channel --- */
  const surgeMult   = () => 1 + Config.SURGE.coefficient * Math.log10(1 + (State.get().surge || 0));
  const effectiveQps = () => qps() * surgeMult();

  function surgeCost(){
    const q = State.get().quanta;
    return Math.max(Config.SURGE.minCost, q * Config.SURGE.costPct);
  }

  function surgeReference(){
    const q = State.get().quanta;
    return Math.max(Config.SURGE.minReference, Math.sqrt(q * 100));
  }

  function surgeGain(){
    return Math.log10(1 + surgeCost() / surgeReference());
  }

  return {
    softcap, softcapThreshold, channelMult, globalMult,
    rawTap, tapGain, rawAuto, qps,
    coherenceBase, coherenceGain, collapseCost,
    surgeMult, effectiveQps, surgeCost, surgeReference, surgeGain
  };
})();


/* =========================================================================
   Save
   ========================================================================= */
const Save = (() => {
  const num      = v => (Number.isFinite(+v) ? +v : 0);
  const clampInt = v => Math.max(0, Math.floor(num(v)));

  function write(){
    const s = State.get();
    s.lastSave = Date.now();
    try { localStorage.setItem(Config.SAVE_KEY, JSON.stringify(s)); } catch(e){}
  }

  function read(){
    let raw;
    try { raw = localStorage.getItem(Config.SAVE_KEY); } catch(e){ return false; }
    if (!raw) return false;

    let parsed;
    try { parsed = JSON.parse(raw); } catch(e){ return false; }
    if (!parsed || typeof parsed !== 'object') return false;

    const def = State.blank();
    const merged = {
      quanta:    num(parsed.quanta),
      total:     num(parsed.total),
      taps:      num(parsed.taps),
      coherence: num(parsed.coherence),
      collapses: clampInt(parsed.collapses),
      surge:     num(parsed.surge),             // NEW (defaults to 0 for old saves)
      start:     num(parsed.start)    || Date.now(),
      lastSave:  num(parsed.lastSave) || Date.now(),
      up:  Object.assign({}, def.up,  parsed.up  || {}),
      mod: Object.assign({}, def.mod, parsed.mod || {}),
      cUp: Object.assign({}, def.cUp, parsed.cUp || {})
    };
    for (const k in merged.up)  merged.up[k]  = clampInt(merged.up[k]);
    for (const k in merged.mod) merged.mod[k] = clampInt(merged.mod[k]);
    for (const k in merged.cUp) merged.cUp[k] = clampInt(merged.cUp[k]);

    State.replace(merged);

    const away = Math.min((Date.now() - merged.lastSave) / 1000, Config.OFFLINE_CAP);

    /* Surge decays offline at the same rate as live play */
    if (away > 0.5 && merged.surge > 0){
      merged.surge *= Math.pow(1 - Config.SURGE.decay, away);
      if (merged.surge < 0.001) merged.surge = 0;
    }

    if (away > 5){
      const gain = Calc.effectiveQps() * away;   // uses post-decay surge
      if (gain > 0){
        const s = State.get();
        s.quanta += gain;
        s.total  += gain;
        setTimeout(
          () => UI.toast('Offline ' + Format.time(away) + ' → +' + Format.num(gain) + ' Q'),
          400
        );
      }
    }
    return true;
  }

  function wipe(){
    try { localStorage.removeItem(Config.SAVE_KEY); } catch(e){}
  }

  return { write, read, wipe };
})();


/* =========================================================================
   UI
   ========================================================================= */
const UI = (() => {

  const $ = sel => document.querySelector(sel);
  const refs = { up:{}, mod:{}, cUp:{} };
  let lastFormulaSig = '';
  let toastTimer = null;
  const NBSP = '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0';

  /* ---------------- shell ---------------- */

  function statRow(label, id, initial){
    return div({ className:'stat-row' }, [
      span({}, label),
      el('b', { id }, initial)
    ]);
  }

  function buildHud(){
    return el('header', { id:'hud' }, [
      div({ className:'qval', id:'quantaVal' }, '0'),
      div({ className:'qlabel' }, 'QUANTA'),
      div({ className:'hud-sub' }, [
        div({ className:'pill' }, [
          span({ className:'k' }, 'ΔQ/TAP'),
          span({ className:'v', id:'tapVal' }, '+1.00')
        ]),
        div({ className:'pill' }, [
          span({ className:'k' }, 'Q/S'),
          span({ className:'v', id:'qpsVal' }, '+0.00')
        ]),
        div({ className:'pill' }, [
          span({ className:'k' }, '𝒞'),
          span({ className:'v', id:'cohVal' }, '0')
        ]),
        div({ className:'pill c' }, [
          span({ className:'k' }, 'SURGE'),
          span({ className:'v', id:'surgeVal' }, '×1.00')
        ])
      ])
    ]);
  }

  function buildSurgePanel(){
    return div({ className:'panel surge-panel', id:'surgePanel' }, [
      div({ className:'surge-title-row' }, [
        div({ className:'panel-title', style:{ margin:0 } }, 'Quantum Surge'),
        span({ className:'surge-mult', id:'surgeMult' }, '×1.00')
      ]),
      el('button', { className:'consume-btn', id:'consumeBtn' }, [
        span({ className:'consume-label' }, ['CONSUME ', el('b', { id:'consumeCost' }, '10'), ' Q']),
        span({ className:'consume-gain', id:'consumeGain' }, '+0.00')
      ]),
      div({ className:'surge-meta' }, [
        span({}, ['pool ', el('b', { id:'surgePool' }, '0.00')]),
        span({}, 'decays 10%/s · boosts QPS')
      ])
    ]);
  }

  function buildObserveView(){
    const tapBtn = el('button', { id:'tapBtn', 'aria-label':'Observe' }, [
      span({ className:'tap-glyph' }, 'Ψ'),
      span({ className:'tap-text' },  'OBSERVE')
    ]);
    const floaters = div({ className:'floatHost', id:'floaters' });
    const tapWrap  = div({ className:'tapWrap' }, [tapBtn, floaters]);

    const surgePanel = buildSurgePanel();

    const formulaPanel = div({ className:'panel' }, [
      div({ className:'panel-title' }, 'Live Formula'),
      div({ className:'formula', id:'formula' })
    ]);

    const telemetry = div({ className:'panel' }, [
      div({ className:'panel-title' }, 'Telemetry'),
      statRow('Total Quanta harvested',   'statTotal',     '0'),
      statRow('Observations performed',   'statTaps',      '0'),
      statRow('Effective ΔQ/tap',         'statTapGain',   '1.00'),
      statRow('Global resonance',         'statGlobal',    '×1.00'),
      statRow('Collapses performed',      'statCollapses', '0'),
      statRow('Uptime',                   'statTime',      '0s')
    ]);

    const resetBtn = el('button', { className:'ghost', id:'resetBtn' }, 'Reset Save');
    const hint = div({ className:'hint' },
      'Surge multiplies your QPS — buy Vacuum Collectors so it has something to multiply.');

    return el('section', { className:'view active', dataset:{ view:'observe' } }, [
      tapWrap, surgePanel, formulaPanel, telemetry, resetBtn, hint
    ]);
  }

  function buildUpgradesView(){
    return el('section', { className:'view', dataset:{ view:'upgrades' } }, [
      div({ className:'list', id:'upgradeList' }),
      div({ className:'hint' },
        'Upgrades cost Quanta and grow geometrically. The Saturation Buffer raises the softcap thresholds — past the cap, extra output compresses logarithmically.')
    ]);
  }

  function buildCoherenceView(){
    const canvas = el('canvas', { id:'waveCanvas' });
    const cohFloaters = div({ className:'floatHost', id:'cohFloaters' });
    const waveWrap = div({ className:'wave-wrap' }, [canvas, cohFloaters]);

    const waveQuality = span({ className:'wq-val', id:'waveQuality' }, '×1.00');
    const readout = div({ className:'wave-readout' }, [
      span({ className:'wq-label' }, 'WAVE QUALITY'),
      waveQuality
    ]);

    const collapseBtn = el('button', { className:'collapse-btn', id:'collapseBtn' }, [
      span({ className:'cb-main' }, 'COLLAPSE'),
      span({ className:'cb-gain', id:'collapseGain' }, '+0 𝒞'),
      span({ className:'cb-cost' }, ['cost ', span({ id:'collapseCost' }, '25'), ' Q'])
    ]);

    const wavePanel = div({ className:'panel' }, [
      div({ className:'panel-title' }, 'Coherence Wave'),
      waveWrap, readout, collapseBtn
    ]);

    const phasePanel = div({ className:'panel' }, [
      div({ className:'panel-title' }, 'Phase Upgrades'),
      div({ className:'list', id:'phaseList' })
    ]);

    const hint = div({ className:'hint' },
      'Coherence yield = base × (0.1 + 0.9 × wave). Time your collapses into the peaks. Stabilizers raise the wave floor, so troughs hurt less.');

    return el('section', { className:'view', dataset:{ view:'coherence' } }, [
      wavePanel, phasePanel, hint
    ]);
  }

  function buildModifiersView(){
    return el('section', { className:'view', dataset:{ view:'modifiers' } }, [
      div({ className:'list', id:'modifierList' }),
      div({ className:'hint' },
        'Weighted modifiers: each level adds a fixed fraction to its channel. Ψ → observation, Φ → automation, Λ → every channel (including nothing else — yet).')
    ]);
  }

  function buildViews(){
    return el('main', { id:'views' }, [
      buildObserveView(),
      buildUpgradesView(),
      buildCoherenceView(),
      buildModifiersView()
    ]);
  }

  function buildTabs(){
    const tabs = [
      ['observe',  '◉', 'OBSERVE'],
      ['upgrades', '⚙', 'UPGRADES'],
      ['coherence','∿', 'COHERENCE'],
      ['modifiers','Ψ', 'MODIFIERS']
    ];
    return el('nav', { id:'tabs' }, tabs.map(([key, icon, label], i) =>
      el('button', {
        className: 'tab' + (i === 0 ? ' active' : ''),
        dataset:   { tab: key }
      }, [
        span({ className:'ic' }, icon),
        span({}, label)
      ])
    ));
  }

  function buildToast(){ return div({ id:'toast' }); }

  /* ---------------- cards ---------------- */

  function makeCard(container, def, kind){
    const lvB    = el('b', {}, '0');
    const lvSpan = span({ className:'card-lv' }, ['LV ', lvB]);

    const nameChildren = def.sym
      ? [span({ className:'sym' }, def.sym), ' ', def.name]
      : [def.name];
    const nameSpan = span({ className:'card-name' }, nameChildren);

    const top     = div({ className:'card-top' }, [nameSpan, lvSpan]);
    const flavor  = div({ className:'card-flavor' }, def.flavor);
    const effect  = div({ className:'card-effect' });
    const costNum = span({});
    const cost    = div({ className:'card-cost' },
      [costNum, kind === 'cUp' ? ' 𝒞' : ' Q']);

    const btn = el('button', {
      className: 'card' + (kind === 'cUp' ? ' mag' : ''),
      id: kind + '-' + def.id,
      onClick: () => Game.buy(def.id, kind)
    }, [top, flavor, effect, cost]);

    container.appendChild(btn);
    refs[kind][def.id] = { el: btn, lv: lvB, effect, cost: costNum };
  }

  function build(){
    document.body.append(
      buildHud(),
      buildViews(),
      buildTabs(),
      buildToast()
    );

    for (const def of Config.UPGRADES)       makeCard($('#upgradeList'),  def, 'up');
    for (const def of Config.MODIFIERS)      makeCard($('#modifierList'), def, 'mod');
    for (const def of Config.PHASE_UPGRADES) makeCard($('#phaseList'),    def, 'cUp');
  }

  /* ---------------- feedback ---------------- */

  function flash(domId){
    const node = document.getElementById(domId);
    if (!node) return;
    node.classList.remove('flash');
    void node.offsetWidth;
    node.classList.add('flash');
    setTimeout(() => node.classList.remove('flash'), 420);
  }

  function floater(host, text, cls){
    if (host.childElementCount > 26) host.firstElementChild.remove();
    const node = div({
      className: 'floater' + (cls ? ' ' + cls : ''),
      style:     { left: (42 + Math.random() * 16) + '%' }
    }, text);
    node.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
    node.addEventListener('animationend', () => node.remove());
    host.appendChild(node);
  }

  function toast(msg){
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = msg;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
  }

  /* ---------------- renderers ---------------- */

  function renderCards(){
    const s = State.get();

    for (const def of Config.UPGRADES){
      const r = refs.up[def.id];
      const lv = s.up[def.id] || 0;
      const cost = def.cost(lv);
      r.lv.textContent = lv;
      r.effect.textContent = def.effect(lv);
      r.cost.textContent = Format.num(cost);
      r.el.classList.toggle('can',  s.quanta >= cost);
      r.el.classList.toggle('poor', s.quanta < cost);
    }

    for (const def of Config.MODIFIERS){
      const r = refs.mod[def.id];
      const lv = s.mod[def.id] || 0;
      const cost = def.cost(lv);
      r.lv.textContent = lv;
      r.effect.textContent = def.sym + ' ×' + Format.plain(1 + def.weight * lv) +
                             '  →  ×' + Format.plain(1 + def.weight * (lv + 1));
      r.cost.textContent = Format.num(cost);
      r.el.classList.toggle('can',  s.quanta >= cost);
      r.el.classList.toggle('poor', s.quanta < cost);
    }

    for (const def of Config.PHASE_UPGRADES){
      const r = refs.cUp[def.id];
      const lv = s.cUp[def.id] || 0;
      const cost = def.cost(lv);
      r.lv.textContent = lv;
      r.effect.textContent = def.effect(lv);
      r.cost.textContent = Format.num(cost);
      r.el.classList.toggle('can',  s.coherence >= cost);
      r.el.classList.toggle('poor', s.coherence < cost);
    }
  }

  function renderFormula(){
    const s = State.get();

    /* observation channel */
    const tT = ['(1+' + s.up.observer + ')'], tV = [1 + s.up.observer];
    for (const m of Config.MODIFIERS){
      if (m.target === 'tap' || m.target === 'all'){
        const lv = s.mod[m.id] || 0;
        if (lv > 0){ tT.push('(1+' + m.weight + '×' + lv + ')'); tV.push(1 + m.weight * lv); }
      }
    }
    if (s.up.resonance > 0){
      tT.push('(1.25^' + s.up.resonance + ')');
      tV.push(Math.pow(Config.RESONANCE_BASE, s.up.resonance));
    }
    if (s.cUp.lock > 0){
      tT.push('(1.15^' + s.cUp.lock + ')');
      tV.push(Math.pow(Config.PHASE_BASE, s.cUp.lock));
    }
    const tRaw = tV.reduce((a, b) => a * b, 1);
    const tCap = Calc.softcapThreshold('tap');
    const tFin = Calc.softcap(tRaw, 'tap');

    /* automation channel — base raised to 1.0 */
    const aT = ['1.0', String(s.up.collector)], aV = [1.0, s.up.collector];
    for (const m of Config.MODIFIERS){
      if (m.target === 'auto' || m.target === 'all'){
        const lv = s.mod[m.id] || 0;
        if (lv > 0){ aT.push('(1+' + m.weight + '×' + lv + ')'); aV.push(1 + m.weight * lv); }
      }
    }
    if (s.up.resonance > 0){
      aT.push('(1.25^' + s.up.resonance + ')');
      aV.push(Math.pow(Config.RESONANCE_BASE, s.up.resonance));
    }
    if (s.cUp.lock > 0){
      aT.push('(1.15^' + s.cUp.lock + ')');
      aV.push(Math.pow(Config.PHASE_BASE, s.cUp.lock));
    }
    const aRaw = aV.reduce((a, b) => a * b, 1);
    const aCap = Calc.softcapThreshold('auto');
    const aFin = Calc.softcap(aRaw, 'auto');

    const surgeQ  = Math.round((s.surge || 0) * 10) / 10;
    const sig = [s.up.observer, s.up.collector, s.up.resonance, s.up.buffer,
                 s.mod.psi, s.mod.phi, s.mod.lam, s.cUp.lock, surgeQ].join('|');
    if (sig === lastFormulaSig) return;
    lastFormulaSig = sig;

    const children = [
      div({}, [span({ className:'f-k' }, 'ΔQ/tap'), ' = ' + tT.join(' × ')]),
      div({ className:'f-dim' }, NBSP + '= ' + tV.map(Format.plain).join(' × ')),
      div({ className:'f-res' }, NBSP + '= ' + Format.num(tFin))
    ];
    if (tRaw > tCap){
      children.push(div({ className:'f-cap' },
        'softcap: ' + Format.num(tRaw) + ' exceeds cap ' + Format.num(tCap) +
        ' → ' + Format.num(tFin)));
    }
    children.push(div({ className:'f-sep' }));
    children.push(div({}, [span({ className:'f-k' }, 'dQ/dt'), NBSP + '= ' + aT.join(' × ')]));
    children.push(div({ className:'f-res' }, NBSP + '= ' + Format.num(aFin) + ' /s'));
    if (aRaw > aCap){
      children.push(div({ className:'f-cap' },
        'softcap: ' + Format.num(aRaw) + ' exceeds cap ' + Format.num(aCap) +
        ' → ' + Format.num(aFin)));
    }
    if ((s.surge || 0) > 0.01){
      const m = Calc.surgeMult();
      children.push(div({ className:'f-k', style:{ marginTop:'6px' } },
        'SURGE ×' + Format.plain(m) + '  →  dQ/dt = ' + Format.num(aFin * m) + ' /s'));
    }

    $('#formula').replaceChildren(...children);
  }

  function renderSurge(){
    const s = State.get();
    const mult = Calc.surgeMult();
    const pool = s.surge || 0;

    const surgeValEl = $('#surgeVal');
    const surgeMultEl = $('#surgeMult');
    const surgePoolEl = $('#surgePool');
    if (!surgeValEl) return;

    surgeValEl.textContent  = '×' + Format.plain(mult);
    surgeMultEl.textContent = '×' + Format.plain(mult);
    surgePoolEl.textContent = Format.plain(pool);

    const cost = Calc.surgeCost();
    const gain = Calc.surgeGain();
    $('#consumeCost').textContent = Format.num(cost);
    $('#consumeGain').textContent = '+' + Format.plain(gain);

    const btn = $('#consumeBtn');
    btn.classList.toggle('poor', s.quanta < cost);
    $('#surgePanel').classList.toggle('active', pool > 0.01);
  }

  function renderHUD(){
    const s = State.get();
    const t = Game.clock();

    $('#quantaVal').textContent = Format.num(s.quanta);
    $('#tapVal').textContent    = '+' + Format.num(Calc.tapGain());
    $('#qpsVal').textContent    = '+' + Format.num(Calc.qps());
    $('#cohVal').textContent    = Format.num(s.coherence);

    renderSurge();

    const q   = Wave.quality(t);
    const wq  = $('#waveQuality');
    wq.textContent = '×' + Format.plain(q);
    wq.classList.toggle('hot', q > 0.9);

    const gain = Calc.coherenceGain(t);
    const cost = Calc.collapseCost();
    $('#collapseGain').textContent = '+' + Format.num(gain) + ' 𝒞';
    $('#collapseCost').textContent = Format.num(cost);

    const btn = $('#collapseBtn');
    btn.classList.toggle('hot',  q > 0.9);
    btn.classList.toggle('poor', s.quanta < cost);
  }

  function renderStats(){
    const s = State.get();
    $('#statTotal').textContent     = Format.num(s.total);
    $('#statTaps').textContent      = Format.num(s.taps);
    $('#statTapGain').textContent   = Format.num(Calc.tapGain());
    $('#statGlobal').textContent    = '×' + Format.num(Calc.globalMult());
    $('#statCollapses').textContent = Format.num(s.collapses);
    $('#statTime').textContent      = Format.time((Date.now() - s.start) / 1000);
  }

  function render(){
    renderHUD();
    renderCards();
    renderFormula();
    renderStats();
  }

  return { build, render, flash, floater, toast, refs };
})();


/* =========================================================================
   WaveScope
   ========================================================================= */
const WaveScope = (() => {
  let canvas, ctx, W = 0, H = 0, ready = false, visible = false;

  function resize(){
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2){ ready = false; return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = rect.width; H = rect.height;
    ready = true;
  }

  function init(){
    canvas = document.getElementById('waveCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
  }

  function setVisible(v){
    visible = v;
    if (v) requestAnimationFrame(resize);
  }

  function draw(){
    if (!visible || !ready || !ctx) return;

    const t = Game.clock();
    const span = Config.WAVE.span;
    const N = 96;
    const pad = 6;
    const ih = H - pad * 2;

    ctx.clearRect(0, 0, W, H);

    const f = Wave.floor();
    if (f > 0.001){
      const fy = H - pad - f * ih;
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      ctx.moveTo(0, fy); ctx.lineTo(W, fy);
      ctx.strokeStyle = 'rgba(255, 62, 165, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const pts = new Array(N + 1);
    for (let i = 0; i <= N; i++){
      const tt = t - span + (i / N) * span;
      const v  = Wave.value(tt);
      pts[i] = [(i / N) * W, H - pad - v * ih];
    }

    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(W, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(63, 233, 255, 0.32)');
    grad.addColorStop(1, 'rgba(63, 233, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    const cur = Wave.value(t);
    const hot = cur > 0.88;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = hot ? '#4dffa6' : '#3fe9ff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const hy = H - pad - cur * ih;
    ctx.beginPath();
    ctx.arc(W - 2, hy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = hot ? '#4dffa6' : '#3fe9ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  return { init, resize, setVisible, draw };
})();


/* =========================================================================
   Game
   ========================================================================= */
const Game = (() => {

  const T0 = performance.now();
  const clock = () => (performance.now() - T0) / 1000;

  let lastFrame = performance.now();
  let renderAcc = 0;
  let lastWall  = Date.now();

  /* ---------------- actions ---------------- */

  function observe(){
    const gain = Calc.tapGain();
    const s = State.get();

    s.quanta += gain;
    s.total  += gain;
    s.taps   += 1;

    UI.floater(document.getElementById('floaters'), '+' + Format.num(gain));
    if (navigator.vibrate){ try { navigator.vibrate(8); } catch(e){} }
  }

  /* --- NEW: consume quanta → surge --- */
  function consume(){
    const s = State.get();
    const cost = Calc.surgeCost();
    if (s.quanta < cost) return;

    const gain = Calc.surgeGain();

    s.quanta -= cost;
    s.surge   = (s.surge || 0) + gain;

    UI.floater(document.getElementById('floaters'),
      '+' + Format.plain(gain) + ' surge', 'c');
    if (navigator.vibrate){ try { navigator.vibrate(10); } catch(e){} }

    UI.render();
    Save.write();
  }

  function collapse(){
    const s = State.get();
    const cost = Calc.collapseCost();
    if (s.quanta < cost) return;

    const gain = Calc.coherenceGain(clock());

    s.quanta    -= cost;
    s.coherence += gain;
    s.collapses += 1;

    UI.floater(document.getElementById('cohFloaters'), '+' + Format.num(gain) + ' 𝒞', 'c');
    if (navigator.vibrate){ try { navigator.vibrate(12); } catch(e){} }

    UI.render();
    Save.write();
  }

  function buy(id, kind){
    const s = State.get();
    const defs  = kind === 'up'  ? Config.UPGRADES
                : kind === 'mod' ? Config.MODIFIERS
                :                  Config.PHASE_UPGRADES;
    const store = kind === 'up'  ? s.up
                : kind === 'mod' ? s.mod
                :                  s.cUp;
    const bank  = kind === 'cUp' ? s.coherence : s.quanta;

    const def = defs.find(d => d.id === id);
    if (!def) return;

    const lv   = store[id] || 0;
    const cost = def.cost(lv);
    if (bank < cost) return;

    if (kind === 'cUp') s.coherence -= cost;
    else                s.quanta    -= cost;

    store[id] = lv + 1;

    UI.flash(kind + '-' + id);
    UI.render();
    Save.write();
  }

  /* ---------------- input ---------------- */

  function wireInputs(){
    const tapBtn = document.getElementById('tapBtn');

    on(tapBtn, 'pointerdown', e => {
      e.preventDefault();
      tapBtn.classList.add('pressed');
      observe();
    });
    const release = () => tapBtn.classList.remove('pressed');
    on(tapBtn, 'pointerup',     release);
    on(tapBtn, 'pointercancel', release);
    on(tapBtn, 'pointerleave',  release);

    on(document.getElementById('consumeBtn'), 'pointerdown', e => {
      e.preventDefault();
      consume();
    });

    on(document.getElementById('collapseBtn'), 'pointerdown', e => {
      e.preventDefault();
      collapse();
    });

    document.querySelectorAll('.tab').forEach(tab => {
      on(tab, 'click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        const name = tab.dataset.tab;
        document.querySelectorAll('.view').forEach(v => {
          v.classList.toggle('active', v.dataset.view === name);
        });
        document.getElementById('views').scrollTop = 0;
        WaveScope.setVisible(name === 'coherence');
        UI.render();
      });
    });

    on(document.getElementById('resetBtn'), 'click', () => {
      if (confirm('Erase all progress and start over?')){
        Save.wipe();
        location.reload();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden){
        Save.write();
      } else {
        const away = (Date.now() - lastWall) / 1000;
        const s = State.get();

        if (s.surge > 0){
          s.surge *= Math.pow(1 - Config.SURGE.decay, Math.min(away, Config.OFFLINE_CAP));
          if (s.surge < 0.001) s.surge = 0;
        }
        if (away > 1){
          const g = Calc.effectiveQps() * Math.min(away, Config.OFFLINE_CAP);
          if (g > 0){
            s.quanta += g;
            s.total  += g;
          }
        }
        lastWall  = Date.now();
        lastFrame = performance.now();
        WaveScope.resize();
        UI.render();
      }
    });

    window.addEventListener('pagehide',       Save.write);
    window.addEventListener('beforeunload',   Save.write);
    window.addEventListener('resize',         () => WaveScope.resize());
    window.addEventListener('orientationchange',
      () => setTimeout(() => WaveScope.resize(), 120));
  }

  /* ---------------- main loop ---------------- */

  function frame(now){
    let dt = (now - lastFrame) / 1000;
    lastFrame = now;
    lastWall  = Date.now();

    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 86400) dt = 86400;

    const s = State.get();

    /* 1. Surge decays first, so this frame's passive reflects the new value. */
    if (s.surge > 0){
      s.surge *= Math.pow(1 - Config.SURGE.decay, dt);
      if (s.surge < 0.001) s.surge = 0;
    }

    /* 2. Passive gain uses the *effective* QPS (base × surge multiplier). */
    const passive = Calc.effectiveQps() * dt;
    if (passive > 0){
      s.quanta += passive;
      s.total  += passive;
    }

    /* 3. Throttled DOM render (~15 fps). */
    renderAcc += dt;
    if (renderAcc >= 0.066){
      renderAcc = 0;
      UI.render();
    }

    WaveScope.draw();
    requestAnimationFrame(frame);
  }

  /* ---------------- boot ---------------- */

  function boot(){
    UI.build();
    Save.read();
    wireInputs();

    WaveScope.init();
    WaveScope.setVisible(
      document.querySelector('.view.active').dataset.view === 'coherence'
    );

    UI.render();
    setInterval(Save.write, 15000);

    lastFrame = performance.now();
    lastWall  = Date.now();
    requestAnimationFrame(frame);
  }

  return { boot, clock, observe, consume, collapse, buy };
})();


/* GO */
Game.boot();