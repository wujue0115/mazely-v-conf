import type { MazePoint } from 'mazely'

export interface MaskGrid {
  mask: boolean[][]
  colors: (string | null)[][]
  activeCellCount: number
}

export interface MaskSamplingOptions {
  alphaThreshold?: number
  coverageThreshold?: number
  whiteThreshold?: number
}

export function buildMaskGrid(
  image: ImageData,
  cols: number,
  rows: number,
  options: MaskSamplingOptions = {},
): MaskGrid {
  const alphaThreshold = options.alphaThreshold ?? 80
  const coverageThreshold = options.coverageThreshold ?? 0.34
  const whiteThreshold = options.whiteThreshold
  const mask: boolean[][] = Array.from(
    { length: rows },
    () => Array<boolean>(cols).fill(false),
  )
  const colors: (string | null)[][] = Array.from(
    { length: rows },
    () => Array<string | null>(cols).fill(null),
  )

  for (let row = 0; row < rows; row += 1) {
    const startY = Math.floor((row * image.height) / rows)
    const endY = Math.max(startY + 1, Math.floor(((row + 1) * image.height) / rows))
    for (let col = 0; col < cols; col += 1) {
      const startX = Math.floor((col * image.width) / cols)
      const endX = Math.max(startX + 1, Math.floor(((col + 1) * image.width) / cols))
      let opaquePixels = 0
      let red = 0
      let green = 0
      let blue = 0
      let colorWeight = 0

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const offset = (y * image.width + x) * 4
          const alpha = image.data[offset + 3]!
          if (alpha < alphaThreshold) {
            continue
          }
          const pixelRed = image.data[offset]!
          const pixelGreen = image.data[offset + 1]!
          const pixelBlue = image.data[offset + 2]!
          if (
            whiteThreshold !== undefined
            && pixelRed >= whiteThreshold
            && pixelGreen >= whiteThreshold
            && pixelBlue >= whiteThreshold
          ) {
            continue
          }
          const weight = alpha / 255
          opaquePixels += 1
          red += pixelRed * weight
          green += pixelGreen * weight
          blue += pixelBlue * weight
          colorWeight += weight
        }
      }

      const pixelCount = (endX - startX) * (endY - startY)
      if (opaquePixels / pixelCount < coverageThreshold || colorWeight === 0) {
        continue
      }

      mask[row]![col] = true
      colors[row]![col] = rgbToHex(
        Math.round(red / colorWeight),
        Math.round(green / colorWeight),
        Math.round(blue / colorWeight),
      )
    }
  }

  keepLargestConnectedRegion(mask, colors)
  return {
    activeCellCount: mask.reduce(
      (total, line) => total + line.filter(Boolean).length,
      0,
    ),
    colors,
    mask,
  }
}

export async function loadImageMask(
  source: string,
  cols: number,
  rows: number,
  options: MaskSamplingOptions = {},
): Promise<MaskGrid> {
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Canvas 2D is unavailable; the image mask could not be created.')
  }
  context.drawImage(image, 0, 0)
  return buildMaskGrid(
    context.getImageData(0, 0, canvas.width, canvas.height),
    cols,
    rows,
    options,
  )
}

export function pickActiveCell(
  mask: readonly (readonly boolean[])[],
  randomValue: number,
): MazePoint {
  const activeCells: MazePoint[] = []
  for (let y = 0; y < mask.length; y += 1) {
    for (let x = 0; x < (mask[y]?.length ?? 0); x += 1) {
      if (mask[y]![x]) {
        activeCells.push({ x, y })
      }
    }
  }
  if (activeCells.length === 0) {
    throw new Error('The image mask does not contain any active cells.')
  }
  const index = Math.min(
    activeCells.length - 1,
    Math.floor(Math.max(0, randomValue) * activeCells.length),
  )
  return activeCells[index]!
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load the image mask from ${source}.`))
    image.src = source
  })
}

function keepLargestConnectedRegion(
  mask: boolean[][],
  colors: (string | null)[][],
): void {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  const labels = new Int32Array(rows * cols)
  const sizes: number[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const start = row * cols + col
      if (!mask[row]![col] || labels[start] !== 0) {
        continue
      }
      const label = sizes.length + 1
      const queue = [start]
      labels[start] = label
      let size = 0
      for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head]!
        size += 1
        const x = current % cols
        const y = Math.floor(current / cols)
        for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
          if (
            nextX < 0
            || nextX >= cols
            || nextY < 0
            || nextY >= rows
            || !mask[nextY]![nextX]
          ) {
            continue
          }
          const next = nextY * cols + nextX
          if (labels[next] === 0) {
            labels[next] = label
            queue.push(next)
          }
        }
      }
      sizes.push(size)
    }
  }

  if (sizes.length <= 1) {
    return
  }
  const largestLabel = sizes.indexOf(Math.max(...sizes)) + 1
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (labels[row * cols + col] !== largestLabel) {
        mask[row]![col] = false
        colors[row]![col] = null
      }
    }
  }
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${((1 << 24) | (red << 16) | (green << 8) | blue).toString(16).slice(1)}`
}
