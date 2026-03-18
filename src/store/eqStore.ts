import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

export const EQ_BANDS = [
  { freq: 31,    label: '31' },
  { freq: 62,    label: '62' },
  { freq: 125,   label: '125' },
  { freq: 250,   label: '250' },
  { freq: 500,   label: '500' },
  { freq: 1000,  label: '1k' },
  { freq: 2000,  label: '2k' },
  { freq: 4000,  label: '4k' },
  { freq: 8000,  label: '8k' },
  { freq: 16000, label: '16k' },
];

export interface EqPreset {
  name: string;
  gains: number[];
  builtin: boolean;
}

export const BUILTIN_PRESETS: EqPreset[] = [
  { name: 'Flat',        builtin: true, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost',  builtin: true, gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost',builtin: true, gains: [0, 0, 0, 0, 0, 0, 2, 3, 4, 5] },
  { name: 'Rock',        builtin: true, gains: [4, 3, 1, 0, -1, -1, 1, 3, 4, 4] },
  { name: 'Pop',         builtin: true, gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2] },
  { name: 'Jazz',        builtin: true, gains: [4, 3, 1, 2, -1, -1, 0, 1, 2, 3] },
  { name: 'Classical',   builtin: true, gains: [5, 4, 3, 2, -2, -2, 0, 2, 3, 4] },
  { name: 'Electronic',  builtin: true, gains: [5, 4, 1, 0, -2, 1, 1, 2, 4, 5] },
  { name: 'Vocal',       builtin: true, gains: [-2, -2, 0, 3, 5, 5, 3, 1, -1, -2] },
  { name: 'Acoustic',    builtin: true, gains: [3, 2, 2, 2, 0, 0, 1, 2, 2, 3] },
];

interface EqState {
  gains: number[];           // 10 values, -12 to +12 dB
  enabled: boolean;
  activePreset: string | null;
  customPresets: EqPreset[];

  setBandGain: (index: number, gain: number) => void;
  setEnabled: (v: boolean) => void;
  applyPreset: (name: string) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (name: string) => void;
  syncToRust: () => void;
}

function syncEq(gains: number[], enabled: boolean) {
  invoke('audio_set_eq', { gains: gains.map(g => g), enabled }).catch(() => {});
}

export const useEqStore = create<EqState>()(
  persist(
    (set, get) => ({
      gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      enabled: false,
      activePreset: 'Flat',
      customPresets: [],

      setBandGain: (index, gain) => {
        const clamped = Math.max(-12, Math.min(12, gain));
        const gains = [...get().gains];
        gains[index] = clamped;
        set({ gains, activePreset: null });
        syncEq(gains, get().enabled);
      },

      setEnabled: (v) => {
        set({ enabled: v });
        syncEq(get().gains, v);
      },

      applyPreset: (name) => {
        const all = [...BUILTIN_PRESETS, ...get().customPresets];
        const preset = all.find(p => p.name === name);
        if (!preset) return;
        set({ gains: [...preset.gains], activePreset: name });
        syncEq(preset.gains, get().enabled);
      },

      saveCustomPreset: (name) => {
        const gains = [...get().gains];
        const existing = get().customPresets.filter(p => p.name !== name);
        set({ customPresets: [...existing, { name, gains, builtin: false }], activePreset: name });
      },

      deleteCustomPreset: (name) => {
        set(s => ({
          customPresets: s.customPresets.filter(p => p.name !== name),
          activePreset: s.activePreset === name ? null : s.activePreset,
        }));
      },

      syncToRust: () => {
        const { gains, enabled } = get();
        syncEq(gains, enabled);
      },
    }),
    {
      name: 'psysonic-eq',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        gains: s.gains,
        enabled: s.enabled,
        activePreset: s.activePreset,
        customPresets: s.customPresets,
      }),
    }
  )
);
