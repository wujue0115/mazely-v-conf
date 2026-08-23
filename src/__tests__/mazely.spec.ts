import type { MazeGenerationStep } from 'mazely'
import { describe, expect, it } from 'vitest'
import {
  ANIMATION_SPEED_PRESETS,
  DEFAULT_VISUALIZATION_OPTIONS,
  MAZELY_ALGORITHM_MAP,
  toMazelyAlgorithm,
} from '@/mazely/config'
import { buildMaskGrid, pickActiveCell } from '@/mazely/mask'
import { generationStepToVisualEvents } from '@/mazely/renderer'

describe('Mazely visualization configuration', () => {
  it('exposes only the three supported generation algorithms', () => {
    expect(MAZELY_ALGORITHM_MAP).toEqual({
      'recursive-backtracker': 'dfs',
      kruskal: 'kruskal',
      prim: 'prim',
    })
    expect(toMazelyAlgorithm('recursive-backtracker')).toBe('dfs')
  })

  it('configures the interactive 3D solution treatment', () => {
    expect(DEFAULT_VISUALIZATION_OPTIONS.interaction).toMatchObject({
      enabled: true,
      pauseAutoRotateOnInteract: false,
    })
    expect(DEFAULT_VISUALIZATION_OPTIONS.solution).toMatchObject({
      endColor: '#ff384a',
      pathColor: '#ffffff',
      startColor: '#ffffff',
      stepIntervalMs: ANIMATION_SPEED_PRESETS.slow.solutionStepIntervalMs,
    })
  })
})

describe('generation step adapter', () => {
  it('discovers both endpoints once and emits every carved connection', () => {
    const discovered = new Set<string>()
    const step: MazeGenerationStep = {
      patches: [],
      payload: { from: '2:3', to: '2:4' },
      type: 'carve',
    }

    expect(generationStepToVisualEvents(step, discovered)).toEqual([
      { cellId: '2:3', point: { x: 3, y: 2 }, type: 'discover-cell' },
      { cellId: '2:4', point: { x: 4, y: 2 }, type: 'discover-cell' },
      {
        from: { x: 3, y: 2 },
        fromId: '2:3',
        to: { x: 4, y: 2 },
        toId: '2:4',
        type: 'connect-cells',
      },
    ])
    expect(generationStepToVisualEvents(step, discovered)).toHaveLength(1)
  })
})

describe('image mask sampling', () => {
  it('converts alpha and source colors into a connected cell mask', () => {
    const data = new Uint8ClampedArray([
      66, 184, 131, 255,
      0, 0, 0, 0,
      53, 73, 94, 255,
      53, 73, 94, 255,
    ])
    const image = { data, height: 2, width: 2 } as ImageData
    const grid = buildMaskGrid(image, 2, 2, { coverageThreshold: 0.5 })

    expect(grid.mask).toEqual([[true, false], [true, true]])
    expect(grid.colors[0]?.[0]).toBe('#42b883')
    expect(grid.colors[1]?.[0]).toBe('#35495e')
    expect(pickActiveCell(grid.mask, 0)).toEqual({ x: 0, y: 0 })
    expect(pickActiveCell(grid.mask, 0.99)).toEqual({ x: 1, y: 1 })
  })

  it('can exclude detached white artwork from a colored mask', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      139, 92, 246, 255,
    ])
    const image = { data, height: 1, width: 2 } as ImageData
    const grid = buildMaskGrid(image, 2, 1, {
      coverageThreshold: 0.5,
      whiteThreshold: 245,
    })

    expect(grid.mask).toEqual([[false, true]])
    expect(grid.colors[0]?.[1]).toBe('#8b5cf6')
  })
})
