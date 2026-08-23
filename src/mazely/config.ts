import type { MazeGenerationAlgorithm, MazePoint } from 'mazely'

export type MazeAlgorithm = 'recursive-backtracker' | 'prim' | 'kruskal'
export type AnimationSpeed = 'slow' | 'normal' | 'fast'
export type DropEasing = 'easeOutCubic' | 'easeOutBack' | 'bounce'
export type MazeSize = 'small' | 'medium' | 'large'
export type MaskId = 'vue' | 'vite'

export interface MaskPreset {
  id: MaskId
  label: string
  source: string
  colors: {
    primary: string
    secondary: string
    onPrimary: string
  }
  sampling?: { whiteThreshold?: number }
  sizes: Record<MazeSize, { cols: number, rows: number }>
}

export const MAZE_SIZES = ['small', 'medium', 'large'] as const satisfies readonly MazeSize[]
export const MASK_IDS = ['vue', 'vite'] as const satisfies readonly MaskId[]
export const ANIMATION_SPEEDS = ['slow', 'normal', 'fast'] as const satisfies readonly AnimationSpeed[]

export const ANIMATION_SPEED_PRESETS = {
  slow: {
    connectorDelayMs: 80,
    dropDurationMs: 720,
    dropDurationVarianceMs: 180,
    layerStaggerMs: 62,
    solutionStepIntervalMs: 70,
    stepIntervalMs: 40,
  },
  normal: {
    connectorDelayMs: 56,
    dropDurationMs: 500,
    dropDurationVarianceMs: 126,
    layerStaggerMs: 43,
    solutionStepIntervalMs: 45,
    stepIntervalMs: 28,
  },
  fast: {
    connectorDelayMs: 36,
    dropDurationMs: 320,
    dropDurationVarianceMs: 80,
    layerStaggerMs: 28,
    solutionStepIntervalMs: 28,
    stepIntervalMs: 18,
  },
} as const satisfies Record<AnimationSpeed, {
  connectorDelayMs: number
  dropDurationMs: number
  dropDurationVarianceMs: number
  layerStaggerMs: number
  solutionStepIntervalMs: number
  stepIntervalMs: number
}>

export const VUE_MASK_PRESET: MaskPreset = {
  id: 'vue',
  label: 'Vue',
  source: 'vue.webp',
  colors: {
    primary: '#42b883',
    secondary: '#35495e',
    onPrimary: '#092d20',
  },
  sizes: {
    small: { cols: 24, rows: 21 },
    medium: { cols: 31, rows: 27 },
    large: { cols: 37, rows: 32 },
  },
}

export const VITE_MASK_PRESET: MaskPreset = {
  id: 'vite',
  label: 'Vite',
  source: 'vite.webp',
  colors: {
    primary: '#8b5cf6',
    secondary: '#646cff',
    onPrimary: '#ffffff',
  },
  sampling: {
    // The supplied artwork includes a detached white ring. Excluding it keeps
    // the lightning mark as one connected maze mask.
    whiteThreshold: 245,
  },
  sizes: {
    small: { cols: 36, rows: 22 },
    medium: { cols: 45, rows: 28 },
    large: { cols: 54, rows: 33 },
  },
}

export const MASK_PRESETS: Record<MaskId, MaskPreset> = {
  vue: VUE_MASK_PRESET,
  vite: VITE_MASK_PRESET,
}

export interface MazeVisualizationOptions {
  maze: {
    algorithm: MazeAlgorithm
    seed: string | number | null
    cols: number
    rows: number
    start: 'auto' | MazePoint
  }
  playback: {
    autoplay: boolean
    initialDelayMs: number
    stepIntervalMs: number
    restartDelayMs: number
    loop: boolean
  }
  blocks: {
    piecesPerCell: number
    cellSize: number
    cellGap: number
    totalHeight: number
    layerGap: number
    connectorWidth: number
    connectorHeight: number
    connectorDelayMs: number
  }
  drop: {
    spawnHeight: number
    spawnHeightVariance: number
    durationMs: number
    durationVarianceMs: number
    layerStaggerMs: number
    easing: DropEasing
    rotation: boolean
    landingCompression: number
  }
  colors: {
    primary: string
    secondary: string
    connectorMode: 'destination' | 'source' | 'blend'
  }
  camera: {
    fov: number
    autoRotate: boolean
    autoRotateSpeed: number
    allowOrbit: boolean
    allowZoom: boolean
  }
  interaction: {
    enabled: boolean
    pauseAutoRotateOnInteract: boolean
    pointerMoveThreshold: number
  }
  solution: {
    stepIntervalMs: number
    pathRadius: number
    pathOffset: number
    cornerRadius: number
    markerBallRadius: number
    markerConeHeight: number
    markerSelectedLift: number
    markerPreviewLift: number
    markerDropDurationMs: number
    markerRingRadius: number
    hoverRingRadius: number
    startColor: string
    pathColor: string
    endColor: string
  }
  lighting: {
    ambientIntensity: number
    keyIntensity: number
    shadows: boolean
  }
  performance: {
    maxPixelRatio: number
    mobileMaxPixelRatio: number
    mobileBreakpoint: number
  }
  accessibility: {
    respectReducedMotion: boolean
  }
}

export const MAZELY_ALGORITHM_MAP = {
  'recursive-backtracker': 'dfs',
  prim: 'prim',
  kruskal: 'kruskal',
} as const satisfies Record<MazeAlgorithm, MazeGenerationAlgorithm>

export const DEFAULT_VISUALIZATION_OPTIONS: MazeVisualizationOptions = {
  maze: {
    algorithm: 'recursive-backtracker',
    seed: null,
    cols: VUE_MASK_PRESET.sizes.small.cols,
    rows: VUE_MASK_PRESET.sizes.small.rows,
    start: 'auto',
  },
  playback: {
    autoplay: true,
    initialDelayMs: 450,
    stepIntervalMs: 40,
    restartDelayMs: 5000,
    loop: true,
  },
  blocks: {
    piecesPerCell: 3,
    cellSize: 1,
    cellGap: 0.2,
    totalHeight: 0.9,
    layerGap: 0,
    connectorWidth: 0.8,
    connectorHeight: 0.9,
    connectorDelayMs: 80,
  },
  drop: {
    spawnHeight: 9,
    spawnHeightVariance: 3,
    durationMs: 720,
    durationVarianceMs: 180,
    layerStaggerMs: 62,
    easing: 'bounce',
    rotation: true,
    landingCompression: 0.055,
  },
  colors: {
    primary: VUE_MASK_PRESET.colors.primary,
    secondary: VUE_MASK_PRESET.colors.secondary,
    connectorMode: 'blend',
  },
  camera: {
    fov: 42,
    autoRotate: true,
    autoRotateSpeed: 0.22,
    allowOrbit: true,
    allowZoom: true,
  },
  interaction: {
    enabled: true,
    pauseAutoRotateOnInteract: false,
    pointerMoveThreshold: 6,
  },
  solution: {
    stepIntervalMs: ANIMATION_SPEED_PRESETS.slow.solutionStepIntervalMs,
    pathRadius: 0.026,
    pathOffset: 0.035,
    cornerRadius: 0.18,
    markerBallRadius: 0.28,
    markerConeHeight: 0.72,
    markerSelectedLift: 0.16,
    markerPreviewLift: 0.38,
    markerDropDurationMs: 360,
    markerRingRadius: 0.3,
    hoverRingRadius: 0.3,
    startColor: '#ffffff',
    pathColor: '#ffffff',
    endColor: '#ff384a',
  },
  lighting: {
    ambientIntensity: 1.65,
    keyIntensity: 2.4,
    shadows: true,
  },
  performance: {
    maxPixelRatio: 2,
    mobileMaxPixelRatio: 1.5,
    mobileBreakpoint: 768,
  },
  accessibility: {
    respectReducedMotion: true,
  },
}

export function toMazelyAlgorithm(algorithm: MazeAlgorithm): MazeGenerationAlgorithm {
  return MAZELY_ALGORITHM_MAP[algorithm]
}
