export type ColorMode = 'mono' | 'imageSampled' | 'palette';
export type BackgroundEffect = 'none' | 'noise' | 'invertedAscii';

export type Scene = {
  id: string;
  name: string;
  charRamp: string;
  cellSize: number;
  colorMode: ColorMode;
  monoColor?: string;
  palette?: string[];
  effects: {
    skeleton: boolean;
    contour: boolean;
    handTrails: boolean;
  };
  audioReactivity: {
    amplitudeToDensity: number;
    bassToPulse: number;
    beatChurn: number;
  };
  /** When true, the ASCII fills the area OUTSIDE the silhouette. */
  inverted?: boolean;
  backgroundEffect?: BackgroundEffect;
};

export const RAMPS: Record<string, string> = {
  fine: ' .:-=+*#%@',
  coarse: ' .+#@',
  ascii: ' .,:;i1tfLCG08@',
  blocks: ' ░▒▓█',
  dots: ' .·•●',
};

export const SCENES: Scene[] = [
  {
    id: 'classic',
    name: 'Classic',
    charRamp: RAMPS.fine,
    cellSize: 8,
    colorMode: 'mono',
    monoColor: '#f4f4f5',
    effects: { skeleton: true, contour: false, handTrails: true },
    audioReactivity: {
      amplitudeToDensity: 0.4,
      bassToPulse: 0.3,
      beatChurn: 0.15,
    },
    backgroundEffect: 'none',
  },
  {
    id: 'glitch',
    name: 'Glitch',
    charRamp: RAMPS.ascii,
    cellSize: 9,
    colorMode: 'imageSampled',
    effects: { skeleton: true, contour: true, handTrails: true },
    audioReactivity: {
      amplitudeToDensity: 0.7,
      bassToPulse: 0.6,
      beatChurn: 0.85,
    },
    backgroundEffect: 'noise',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    charRamp: RAMPS.dots,
    cellSize: 11,
    colorMode: 'mono',
    monoColor: '#fde047',
    effects: { skeleton: true, contour: true, handTrails: false },
    audioReactivity: {
      amplitudeToDensity: 0.3,
      bassToPulse: 0.5,
      beatChurn: 0.2,
    },
    backgroundEffect: 'none',
  },
  {
    id: 'trail',
    name: 'Trail dance',
    charRamp: RAMPS.dots,
    cellSize: 14,
    colorMode: 'mono',
    monoColor: '#22d3ee',
    effects: { skeleton: false, contour: false, handTrails: true },
    audioReactivity: {
      amplitudeToDensity: 0.2,
      bassToPulse: 0.4,
      beatChurn: 0.1,
    },
    backgroundEffect: 'none',
  },
  {
    id: 'inverted',
    name: 'Inverted',
    charRamp: RAMPS.fine,
    cellSize: 8,
    colorMode: 'imageSampled',
    inverted: true,
    effects: { skeleton: true, contour: true, handTrails: false },
    audioReactivity: {
      amplitudeToDensity: 0.5,
      bassToPulse: 0.5,
      beatChurn: 0.3,
    },
    backgroundEffect: 'none',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    charRamp: RAMPS.blocks,
    cellSize: 10,
    colorMode: 'palette',
    palette: ['#f472b6', '#a78bfa', '#22d3ee', '#facc15', '#34d399'],
    effects: { skeleton: false, contour: true, handTrails: true },
    audioReactivity: {
      amplitudeToDensity: 0.6,
      bassToPulse: 0.95,
      beatChurn: 0.4,
    },
    backgroundEffect: 'none',
  },
];

export function getScene(index: number): Scene {
  return SCENES[((index % SCENES.length) + SCENES.length) % SCENES.length];
}
