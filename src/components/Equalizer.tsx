import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Trash2, RotateCcw } from 'lucide-react';
import { useEqStore, EQ_BANDS, BUILTIN_PRESETS } from '../store/eqStore';

// ─── Frequency response canvas ────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const EQ_Q = 1.41;

function biquadPeakResponse(freq: number, centerHz: number, gainDb: number, sampleRate: number): number {
  if (Math.abs(gainDb) < 0.01) return 0;
  const w0 = (2 * Math.PI * centerHz) / sampleRate;
  const A  = Math.pow(10, gainDb / 40);
  const alpha = Math.sin(w0) / (2 * EQ_Q);
  const b0 =  1 + alpha * A;
  const b1 = -2 * Math.cos(w0);
  const b2 =  1 - alpha * A;
  const a0 =  1 + alpha / A;
  const a1 = -2 * Math.cos(w0);
  const a2 =  1 - alpha / A;
  const w  = (2 * Math.PI * freq) / sampleRate;
  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w), sin2W = Math.sin(2 * w);
  const numRe = b0 + b1 * cosW + b2 * cos2W;
  const numIm =    - b1 * sinW - b2 * sin2W;
  const denRe = a0 + a1 * cosW + a2 * cos2W;
  const denIm =    - a1 * sinW - a2 * sin2W;
  const numMag2 = numRe * numRe + numIm * numIm;
  const denMag2 = denRe * denRe + denIm * denIm;
  return 10 * Math.log10(numMag2 / denMag2);
}

function drawCurve(canvas: HTMLCanvasElement, gains: number[], accentColor: string) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const fMin = 20, fMax = 20000;
  const dbMin = -13, dbMax = 13;
  const padL = 36, padR = 8, padT = 8, padB = 1;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const freqToX = (f: number) =>
    padL + (Math.log10(f / fMin) / Math.log10(fMax / fMin)) * innerW;
  const dbToY = (db: number) =>
    padT + ((dbMax - db) / (dbMax - dbMin)) * innerH;

  // Background
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, W, H);

  // Grid: dB lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [-12, -6, 0, 6, 12].forEach(db => {
    const y = dbToY(db);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(db === 0 ? '0' : (db > 0 ? `+${db}` : `${db}`), padL - 4, y + 3);
  });

  // Grid: frequency lines
  [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].forEach(f => {
    const x = freqToX(f);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, H - padB);
    ctx.stroke();
  });

  // Zero line (brighter)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, dbToY(0));
  ctx.lineTo(W - padR, dbToY(0));
  ctx.stroke();

  // Frequency response curve
  const points: [number, number][] = [];
  const steps = innerW * 2;
  for (let i = 0; i <= steps; i++) {
    const f = fMin * Math.pow(fMax / fMin, i / steps);
    let totalDb = 0;
    for (let band = 0; band < 10; band++) {
      totalDb += biquadPeakResponse(f, EQ_BANDS[band].freq, gains[band], SAMPLE_RATE);
    }
    totalDb = Math.max(dbMin, Math.min(dbMax, totalDb));
    points.push([freqToX(f), dbToY(totalDb)]);
  }

  // Fill under curve
  const grad = ctx.createLinearGradient(0, padT, 0, H);
  grad.addColorStop(0, accentColor.replace(')', ', 0.25)').replace('rgb', 'rgba'));
  grad.addColorStop(1, accentColor.replace(')', ', 0.0)').replace('rgb', 'rgba'));

  ctx.beginPath();
  ctx.moveTo(points[0][0], dbToY(0));
  points.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(points[points.length - 1][0], dbToY(0));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  points.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Equalizer() {
  const { t } = useTranslation();
  const gains         = useEqStore(s => s.gains);
  const enabled       = useEqStore(s => s.enabled);
  const activePreset  = useEqStore(s => s.activePreset);
  const customPresets = useEqStore(s => s.customPresets);
  const { setBandGain, setEnabled, applyPreset, saveCustomPreset, deleteCustomPreset } = useEqStore();

  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || 'rgb(203, 166, 247)';
    drawCurve(canvas, gains, accent);
  }, [gains]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const ro = new ResizeObserver(redraw);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [redraw]);

  const allPresets   = [...BUILTIN_PRESETS, ...customPresets];
  const selectValue  = activePreset ?? '__custom__';
  const isCustomSaved = activePreset && !BUILTIN_PRESETS.some(p => p.name === activePreset);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    saveCustomPreset(name);
    setSaveName('');
    setShowSave(false);
  };

  return (
    <div className="eq-wrap">
      {/* Controls bar */}
      <div className="eq-controls-bar">
        <label className="eq-toggle-label">
          <span>{t('settings.eqEnabled')}</span>
          <label className="toggle-switch" style={{ marginLeft: 8 }}>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            <span className="toggle-track" />
          </label>
        </label>

        <div className="eq-preset-row">
          <select
            className="input eq-preset-select"
            value={selectValue}
            onChange={e => applyPreset(e.target.value)}
          >
            {activePreset === null && <option value="__custom__">{t('settings.eqPresetCustom')}</option>}
            <optgroup label={t('settings.eqPresetBuiltin')}>
              {BUILTIN_PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </optgroup>
            {customPresets.length > 0 && (
              <optgroup label={t('settings.eqPresetCustomGroup')}>
                {customPresets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </optgroup>
            )}
          </select>

          {isCustomSaved && (
            <button className="eq-ctrl-btn" onClick={() => deleteCustomPreset(activePreset!)} title={t('settings.eqDeletePreset')}>
              <Trash2 size={13} />
            </button>
          )}
          <button className="eq-ctrl-btn" onClick={() => applyPreset('Flat')} title={t('settings.eqResetBands')}>
            <RotateCcw size={13} />
          </button>
          <button className="eq-ctrl-btn" onClick={() => setShowSave(v => !v)} title={t('settings.eqSavePreset')}>
            <Save size={13} />
          </button>
        </div>
      </div>

      {showSave && (
        <div className="eq-save-row">
          <input
            type="text" className="input" placeholder={t('settings.eqPresetName')}
            value={saveName} onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus style={{ flex: 1, padding: '6px 12px', fontSize: 13 }}
          />
          <button className="btn btn-primary" onClick={handleSave} disabled={!saveName.trim()}>{t('common.save')}</button>
          <button className="btn btn-ghost" onClick={() => { setShowSave(false); setSaveName(''); }}>{t('common.cancel')}</button>
        </div>
      )}

      {/* EQ panel */}
      <div className={`eq-panel ${!enabled ? 'eq-panel--off' : ''}`}>
        {/* Frequency response */}
        <canvas ref={canvasRef} className="eq-canvas" />

        {/* Fader area */}
        <div className="eq-faders">
          {/* dB scale */}
          <div className="eq-db-scale">
            {[12, 6, 0, -6, -12].map(db => (
              <span key={db} className="eq-db-tick">
                {db > 0 ? `+${db}` : db}
              </span>
            ))}
          </div>

          {/* Bands */}
          {EQ_BANDS.map((band, i) => (
            <div key={band.freq} className="eq-band">
              <span className="eq-gain-val">
                {gains[i] > 0 ? '+' : ''}{gains[i].toFixed(1)}
              </span>
              <div className="eq-fader-track">
                <div className="eq-zero-mark" />
                <input
                  type="range"
                  className="eq-fader"
                  min={-12} max={12} step={0.5}
                  value={gains[i]}
                  onChange={e => setBandGain(i, parseFloat(e.target.value))}
                  disabled={!enabled}
                  aria-label={`${band.label} Hz`}
                />
              </div>
              <span className="eq-freq-label">{band.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
