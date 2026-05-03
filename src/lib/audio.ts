import type { MicSettings } from '../stores/performanceStore';

export type AudioFeatures = {
  amplitude: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
};

export type AudioMode = 'mic' | 'file' | 'none';

type AudioState = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source:
    | MediaStreamAudioSourceNode
    | MediaElementAudioSourceNode
    | null;
  fft: Uint8Array<ArrayBuffer>;
  time: Uint8Array<ArrayBuffer>;
  rollingBass: number;
  lastBeatAt: number;
  mode: AudioMode;
  micStream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
};

let state: AudioState | null = null;

function ensureCtx(): AudioState {
  if (state) return state;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.65;
  const fft = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  const time = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  state = {
    ctx,
    analyser,
    source: null,
    fft,
    time,
    rollingBass: 0,
    lastBeatAt: 0,
    mode: 'none',
    micStream: null,
    audioEl: null,
  };
  return state;
}

async function disconnectCurrentSource() {
  if (!state) return;
  if (state.source) {
    try {
      state.source.disconnect();
    } catch {
      /* noop */
    }
    state.source = null;
  }
  if (state.micStream) {
    state.micStream.getTracks().forEach((t) => t.stop());
    state.micStream = null;
  }
  if (state.audioEl) {
    state.audioEl.pause();
    state.audioEl.src = '';
    state.audioEl.load();
    state.audioEl = null;
  }
  state.mode = 'none';
}

export async function startMic(settings: MicSettings) {
  const s = ensureCtx();
  await disconnectCurrentSource();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
    },
    video: false,
  });
  s.micStream = stream;
  const node = s.ctx.createMediaStreamSource(stream);
  node.connect(s.analyser);
  // Don't connect to destination — would feed back into the room.
  s.source = node;
  s.mode = 'mic';
  if (s.ctx.state === 'suspended') await s.ctx.resume();
}

export function startFile(file: File): HTMLAudioElement {
  const s = ensureCtx();
  // Tear down sync; the previous source would otherwise compete.
  if (s.source) {
    try {
      s.source.disconnect();
    } catch {
      /* noop */
    }
    s.source = null;
  }
  if (s.micStream) {
    s.micStream.getTracks().forEach((t) => t.stop());
    s.micStream = null;
  }
  if (s.audioEl) {
    s.audioEl.pause();
    s.audioEl.src = '';
    s.audioEl.load();
  }

  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.src = URL.createObjectURL(file);
  el.loop = true;
  el.controls = false;
  const node = s.ctx.createMediaElementSource(el);
  node.connect(s.analyser);
  // Also send to speakers so the user actually hears playback.
  node.connect(s.ctx.destination);
  s.source = node;
  s.audioEl = el;
  s.mode = 'file';
  if (s.ctx.state === 'suspended') void s.ctx.resume();
  return el;
}

export async function stopAudio() {
  await disconnectCurrentSource();
}

export function getAudioElement(): HTMLAudioElement | null {
  return state?.audioEl ?? null;
}

export function getMode(): AudioMode {
  return state?.mode ?? 'none';
}

const BAND_BASS = [20, 250];
const BAND_MID = [250, 2000];
const BAND_TREBLE = [2000, 8000];

function bandAverage(
  fft: Uint8Array,
  binSize: number,
  lo: number,
  hi: number,
): number {
  const start = Math.max(1, Math.floor(lo / binSize));
  const end = Math.max(start + 1, Math.floor(hi / binSize));
  let sum = 0;
  let n = 0;
  for (let i = start; i < end && i < fft.length; i++) {
    sum += fft[i];
    n++;
  }
  return n === 0 ? 0 : sum / (n * 255);
}

const SILENT: AudioFeatures = {
  amplitude: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: false,
};

export function getAudioFeatures(now: number = performance.now()): AudioFeatures {
  if (!state || state.mode === 'none') return SILENT;
  const { analyser, fft, time, ctx } = state;
  analyser.getByteFrequencyData(fft);
  analyser.getByteTimeDomainData(time);

  const binSize = ctx.sampleRate / analyser.fftSize;
  const bass = bandAverage(fft, binSize, BAND_BASS[0], BAND_BASS[1]);
  const mid = bandAverage(fft, binSize, BAND_MID[0], BAND_MID[1]);
  const treble = bandAverage(fft, binSize, BAND_TREBLE[0], BAND_TREBLE[1]);

  // RMS amplitude from time-domain.
  let rms = 0;
  for (let i = 0; i < time.length; i++) {
    const v = (time[i] - 128) / 128;
    rms += v * v;
  }
  const amplitude = Math.min(1, Math.sqrt(rms / time.length) * 1.6);

  // Energy-based beat detection on bass.
  const decay = 0.94;
  state.rollingBass = state.rollingBass * decay + bass * (1 - decay);
  const beat =
    bass > state.rollingBass * 1.4 &&
    bass > 0.18 &&
    now - state.lastBeatAt > 250;
  if (beat) state.lastBeatAt = now;

  return { amplitude, bass, mid, treble, beat };
}
