import { create } from 'zustand';
import { SCENES } from '../lib/scenes';

export type ImageEntry = {
  id: string;
  name: string;
  url: string;
  bitmap: ImageBitmap;
};

export type AudioMode = 'mic' | 'file' | 'none';

export type MicSettings = {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
};

type State = {
  webcamReady: boolean;
  audioMode: AudioMode;
  audioFile: File | null;
  micSettings: MicSettings;

  images: ImageEntry[];
  currentImageIndex: number;

  currentSceneIndex: number;
  autoProgress: boolean;
  autoProgressInterval: number;

  controlsVisible: boolean;
  fullscreen: boolean;

  cellSizeOverride: number | null;
  rampOverride: string | null;
  colorModeOverride: 'mono' | 'imageSampled' | 'palette' | null;

  setWebcamReady: (ready: boolean) => void;
  setAudioMode: (mode: AudioMode) => void;
  setAudioFile: (file: File | null) => void;
  setMicSettings: (s: Partial<MicSettings>) => void;

  addImage: (e: ImageEntry) => void;
  removeImage: (id: string) => void;
  setCurrentImageIndex: (i: number) => void;
  cycleImage: () => void;

  setScene: (i: number) => void;
  nextScene: () => void;
  prevScene: () => void;

  toggleAutoProgress: () => void;
  setAutoProgressInterval: (ms: number) => void;

  toggleControls: () => void;
  setFullscreen: (b: boolean) => void;

  setCellSizeOverride: (v: number | null) => void;
  setRampOverride: (v: string | null) => void;
  setColorModeOverride: (v: 'mono' | 'imageSampled' | 'palette' | null) => void;
};

export const usePerformanceStore = create<State>((set, get) => ({
  webcamReady: false,
  audioMode: 'mic',
  audioFile: null,
  micSettings: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },

  images: [],
  currentImageIndex: 0,

  currentSceneIndex: 0,
  autoProgress: true,
  autoProgressInterval: 20_000,

  controlsVisible: true,
  fullscreen: false,

  cellSizeOverride: null,
  rampOverride: null,
  colorModeOverride: null,

  setWebcamReady: (ready) => set({ webcamReady: ready }),
  setAudioMode: (mode) => set({ audioMode: mode }),
  setAudioFile: (file) => set({ audioFile: file }),
  setMicSettings: (s) =>
    set((state) => ({ micSettings: { ...state.micSettings, ...s } })),

  addImage: (e) =>
    set((state) => ({
      images: [...state.images, e],
      currentImageIndex: state.images.length === 0 ? 0 : state.currentImageIndex,
    })),
  removeImage: (id) =>
    set((state) => {
      const next = state.images.filter((i) => i.id !== id);
      const removed = state.images.findIndex((i) => i.id === id);
      const removedEntry = state.images[removed];
      if (removedEntry) URL.revokeObjectURL(removedEntry.url);
      let idx = state.currentImageIndex;
      if (removed >= 0 && removed <= state.currentImageIndex) {
        idx = Math.max(0, state.currentImageIndex - 1);
      }
      return { images: next, currentImageIndex: idx };
    }),
  setCurrentImageIndex: (i) => set({ currentImageIndex: i }),
  cycleImage: () => {
    const { images, currentImageIndex } = get();
    if (images.length === 0) return;
    set({ currentImageIndex: (currentImageIndex + 1) % images.length });
  },

  setScene: (i) =>
    set({
      currentSceneIndex: ((i % SCENES.length) + SCENES.length) % SCENES.length,
    }),
  nextScene: () =>
    set((s) => ({
      currentSceneIndex: (s.currentSceneIndex + 1) % SCENES.length,
    })),
  prevScene: () =>
    set((s) => ({
      currentSceneIndex:
        (s.currentSceneIndex - 1 + SCENES.length) % SCENES.length,
    })),

  toggleAutoProgress: () => set((s) => ({ autoProgress: !s.autoProgress })),
  setAutoProgressInterval: (ms) => set({ autoProgressInterval: ms }),

  toggleControls: () => set((s) => ({ controlsVisible: !s.controlsVisible })),
  setFullscreen: (b) => set({ fullscreen: b }),

  setCellSizeOverride: (v) => set({ cellSizeOverride: v }),
  setRampOverride: (v) => set({ rampOverride: v }),
  setColorModeOverride: (v) => set({ colorModeOverride: v }),
}));
