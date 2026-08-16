import type { Maze, MazeGenerationStep, MazePoint, StepPlayer } from 'mazely'
import type { MaskGrid } from '@/mazely/mask'
import type { MazeAlgorithm, MazeVisualizationOptions } from '@/mazely/config'
import { cellIdToPoint, createMaze } from 'mazely'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { toMazelyAlgorithm } from '@/mazely/config'
import { pickActiveCell } from '@/mazely/mask'

export interface MazeRendererCallbacks {
  onComplete?: () => void
  onPhaseChange?: (phase: MazeRendererPhase) => void
  onPlayingChange?: (playing: boolean) => void
  onProgress?: (progress: number) => void
}

export type MazeRendererPhase =
  | 'generating'
  | 'selecting'
  | 'selecting-start'
  | 'solving'
  | 'solved'

type MazeVisualEvent =
  | { type: 'discover-cell', cellId: string, point: MazePoint }
  | {
    type: 'connect-cells'
    fromId: string
    from: MazePoint
    toId: string
    to: MazePoint
  }

interface FallingInstance {
  index: number
  mesh: THREE.InstancedMesh
  position: THREE.Vector3
  scale: THREE.Vector3
  startY: number
  startTime: number
  duration: number
  rotation: THREE.Quaternion
}

interface PointerStart {
  x: number
  y: number
  marker: 'end' | 'start' | null
}

const IDENTITY_ROTATION = new THREE.Quaternion()

export class MazeRenderer {
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly controls: OrbitControls
  private readonly group = new THREE.Group()
  private readonly blockGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly connectorGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly blockMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.03,
    roughness: 0.74,
  })
  private readonly connectorMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.03,
    roughness: 0.7,
  })
  private readonly blockMesh: THREE.InstancedMesh
  private readonly connectorMesh: THREE.InstancedMesh
  private readonly solutionGroup = new THREE.Group()
  private readonly markerBodyGeometry: THREE.LatheGeometry
  private readonly pathHeadGeometry = new THREE.SphereGeometry(1, 14, 10)
  private readonly markerRingGeometry = new THREE.TorusGeometry(1, 0.07, 10, 36)
  private readonly markerFillGeometry = new THREE.CircleGeometry(1, 40)
  private readonly pathMaterial: THREE.ShaderMaterial
  private readonly pathHeadMaterial: THREE.MeshBasicMaterial
  private readonly startMaterial: THREE.MeshStandardMaterial
  private readonly endMaterial: THREE.MeshStandardMaterial
  private readonly startBodyHoverMaterial: THREE.MeshStandardMaterial
  private readonly startFillMaterial: THREE.MeshBasicMaterial
  private readonly endFillMaterial: THREE.MeshBasicMaterial
  private readonly startHoverMaterial: THREE.MeshBasicMaterial
  private readonly endHoverMaterial: THREE.MeshBasicMaterial
  private readonly startHoverFillMaterial: THREE.MeshBasicMaterial
  private readonly endHoverFillMaterial: THREE.MeshBasicMaterial
  private readonly startMarkerHoverMaterial: THREE.MeshBasicMaterial
  private readonly startMarkerHoverFillMaterial: THREE.MeshBasicMaterial
  private readonly callbacks: MazeRendererCallbacks
  private readonly resizeObserver: ResizeObserver
  private readonly maskGrid: MaskGrid
  private options: MazeVisualizationOptions
  private maze!: Maze
  private player!: StepPlayer<MazeGenerationStep>
  private discoveredCells = new Set<string>()
  private fallingInstances: FallingInstance[] = []
  private blockCellByInstance: MazePoint[] = []
  private blockCount = 0
  private connectorCount = 0
  private animationFrame = 0
  private previousTimestamp = 0
  private timelineMs = 0
  private stepElapsedMs = 0
  private completionElapsedMs = 0
  private completed = false
  private playing: boolean
  private disposed = false
  private generationSeed: string | number = 0
  private autoRotateEnabled: boolean
  private readonly reducedMotion: boolean
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private pointerStart: PointerStart | null = null
  private interactionPausedAutoRotate = false
  private phase: MazeRendererPhase = 'generating'
  private solutionStart: MazePoint | null = null
  private solutionPath: MazePoint[] = []
  private solutionCurve: THREE.Curve<THREE.Vector3> | null = null
  private solutionPathMesh: THREE.Mesh | null = null
  private solutionPathGeometry: THREE.TubeGeometry | null = null
  private solutionHead: THREE.Mesh | null = null
  private solutionProgress = 0
  private solutionPhaseStartedAt = 0
  private startMarker: THREE.Group | null = null
  private endMarker: THREE.Group | null = null
  private hoverMarker: THREE.Group | null = null

  constructor(
    private readonly container: HTMLElement,
    maskGrid: MaskGrid,
    options: MazeVisualizationOptions,
    callbacks: MazeRendererCallbacks = {},
  ) {
    this.maskGrid = maskGrid
    this.options = options
    this.callbacks = callbacks
    this.playing = options.playback.autoplay
    this.autoRotateEnabled = options.camera.autoRotate
    this.reducedMotion = options.accessibility.respectReducedMotion
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.markerBodyGeometry = createMarkerBodyGeometry(
      options.solution.markerBallRadius,
      options.solution.markerConeHeight,
    )
    this.pathMaterial = createPathMaterial(options.solution.pathColor)
    this.pathHeadMaterial = createLightMaterial(options.solution.pathColor, 1)
    this.startMaterial = createMarkerMaterial(options.solution.startColor)
    this.endMaterial = createMarkerMaterial(options.solution.endColor)
    this.startBodyHoverMaterial = createMarkerMaterial('#a8afb7')
    this.startFillMaterial = createFillMaterial(options.solution.startColor, 0.14)
    this.endFillMaterial = createFillMaterial(options.solution.endColor, 0.18)
    this.startHoverMaterial = createLightMaterial(options.solution.startColor, 1)
    this.endHoverMaterial = createLightMaterial(options.solution.endColor, 1)
    this.startHoverFillMaterial = createFillMaterial(options.solution.startColor, 0.16)
    this.endHoverFillMaterial = createFillMaterial(options.solution.endColor, 0.2)
    this.startMarkerHoverMaterial = createLightMaterial('#a8afb7', 1)
    this.startMarkerHoverFillMaterial = createFillMaterial('#a8afb7', 0.24)

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.domElement.className = 'maze-canvas'
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D maze. Select a destination after generation completes.',
    )
    this.container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(options.camera.fov, 1, 0.1, 500)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.065
    this.controls.enablePan = false
    this.controls.enableRotate = options.camera.allowOrbit
    this.controls.enableZoom = options.camera.allowZoom
    this.controls.minPolarAngle = 0.12
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04
    this.controls.autoRotateSpeed = options.camera.autoRotateSpeed

    const pieceCapacity = maskGrid.activeCellCount * options.blocks.piecesPerCell + 8
    const connectorCapacity = maskGrid.activeCellCount + 8
    this.blockMesh = new THREE.InstancedMesh(
      this.blockGeometry,
      this.blockMaterial,
      pieceCapacity,
    )
    this.connectorMesh = new THREE.InstancedMesh(
      this.connectorGeometry,
      this.connectorMaterial,
      connectorCapacity,
    )
    this.blockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.connectorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // Instance transforms move every frame while blocks fall. Three.js cannot
    // keep a reliable aggregate bounding volume for that dynamic range, which
    // can otherwise make the maze disappear at some orbit/zoom angles while
    // its separately rendered shadow remains visible.
    this.blockMesh.frustumCulled = false
    this.connectorMesh.frustumCulled = false
    this.blockMesh.count = 0
    this.connectorMesh.count = 0

    const mobile = window.innerWidth < options.performance.mobileBreakpoint
    const useShadows = options.lighting.shadows && !mobile
    this.renderer.shadowMap.enabled = useShadows
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.blockMesh.castShadow = useShadows
    // Cell layers and connectors meet edge-to-edge. Letting them receive one
    // another's shadow creates dark shadow-map seams on desktop GPUs. They
    // still cast onto the ground, preserving depth without dirty joints.
    this.blockMesh.receiveShadow = false
    this.connectorMesh.castShadow = useShadows
    this.connectorMesh.receiveShadow = false
    this.group.add(this.blockMesh, this.connectorMesh, this.solutionGroup)
    this.scene.add(this.group)

    const hemisphere = new THREE.HemisphereLight(
      0xffffff,
      0x19222b,
      options.lighting.ambientIntensity,
    )
    const key = new THREE.DirectionalLight(0xffffff, options.lighting.keyIntensity)
    key.position.set(-10, 18, 12)
    key.castShadow = useShadows
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -24
    key.shadow.camera.right = 24
    key.shadow.camera.top = 24
    key.shadow.camera.bottom = -24
    this.scene.add(hemisphere, key)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(options.maze.cols + 10, options.maze.rows + 10),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.05
    ground.receiveShadow = useShadows
    this.scene.add(ground)

    this.group.position.set(
      -options.maze.cols / 2,
      0,
      -options.maze.rows / 2,
    )
    this.createGeneration()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp)
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave)
    this.resize()
    this.callbacks.onPlayingChange?.(this.playing)
    this.animationFrame = window.requestAnimationFrame(this.frame)
  }

  play(): void {
    if (this.completed && this.phase !== 'solving') {
      this.restart()
      return
    }
    this.playing = true
    this.callbacks.onPlayingChange?.(true)
  }

  pause(): void {
    this.playing = false
    this.callbacks.onPlayingChange?.(false)
  }

  toggle(): void {
    if (this.playing) {
      this.pause()
    }
    else {
      this.play()
    }
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotateEnabled = enabled
    if (enabled) {
      this.interactionPausedAutoRotate = false
    }
    this.controls.autoRotate = enabled && !this.reducedMotion
  }

  setStepInterval(intervalMs: number): void {
    this.options.playback.stepIntervalMs = THREE.MathUtils.clamp(intervalMs, 10, 240)
  }

  resetView(): void {
    this.fitCamera()
  }

  setAlgorithm(algorithm: MazeAlgorithm): void {
    this.options.maze.algorithm = algorithm
    this.restart()
  }

  regenerate(): void {
    this.restart()
  }

  restart(): void {
    this.createGeneration()
    this.playing = true
    this.callbacks.onPlayingChange?.(true)
  }

  dispose(): void {
    this.disposed = true
    window.cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp)
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave)
    this.controls.dispose()
    this.blockMesh.dispose()
    this.connectorMesh.dispose()
    this.blockGeometry.dispose()
    this.connectorGeometry.dispose()
    this.blockMaterial.dispose()
    this.connectorMaterial.dispose()
    this.markerBodyGeometry.dispose()
    this.pathHeadGeometry.dispose()
    this.markerRingGeometry.dispose()
    this.markerFillGeometry.dispose()
    this.pathMaterial.dispose()
    this.pathHeadMaterial.dispose()
    this.startMaterial.dispose()
    this.endMaterial.dispose()
    this.startBodyHoverMaterial.dispose()
    this.startFillMaterial.dispose()
    this.endFillMaterial.dispose()
    this.startHoverMaterial.dispose()
    this.endHoverMaterial.dispose()
    this.startHoverFillMaterial.dispose()
    this.endHoverFillMaterial.dispose()
    this.startMarkerHoverMaterial.dispose()
    this.startMarkerHoverFillMaterial.dispose()
    this.solutionPathGeometry?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private createGeneration(): void {
    this.clearSolution()
    this.generationSeed = this.options.maze.seed ?? createRandomSeed()
    this.maze = createMaze({
      grid: {
        cols: this.options.maze.cols,
        mask: this.maskGrid.mask,
        rows: this.options.maze.rows,
        type: 'square',
      },
      seed: this.generationSeed,
    })
    const start = this.options.maze.start === 'auto'
      ? pickActiveCell(this.maskGrid.mask, hashUnit(`${this.generationSeed}:start`))
      : this.options.maze.start
    this.player = this.maze.generate(
      toMazelyAlgorithm(this.options.maze.algorithm),
      { start },
    )
    this.discoveredCells = new Set<string>()
    this.fallingInstances = []
    this.blockCellByInstance = []
    this.blockCount = 0
    this.connectorCount = 0
    this.blockMesh.count = 0
    this.connectorMesh.count = 0
    this.blockMesh.instanceMatrix.needsUpdate = true
    this.connectorMesh.instanceMatrix.needsUpdate = true
    this.timelineMs = 0
    this.stepElapsedMs = 0
    this.completionElapsedMs = 0
    this.completed = false
    this.phase = 'generating'
    this.controls.autoRotate = false
    this.interactionPausedAutoRotate = false
    this.renderer.domElement.style.cursor = ''
    this.callbacks.onPhaseChange?.('generating')
    this.callbacks.onProgress?.(0)
  }

  private readonly frame = (timestamp: number): void => {
    if (this.disposed) {
      return
    }
    const delta = this.previousTimestamp === 0
      ? 0
      : Math.min(timestamp - this.previousTimestamp, 80)
    this.previousTimestamp = timestamp

    if (this.playing) {
      this.timelineMs += delta
      if (!this.completed) {
        this.advancePlayback(delta)
      }
      else if (this.phase === 'solving') {
        this.advanceSolutionPlayback(delta)
      }
      else if (
        !this.options.interaction.enabled
        && this.options.playback.loop
        && !this.reducedMotion
      ) {
        this.completionElapsedMs += delta
        if (this.completionElapsedMs >= this.options.playback.restartDelayMs) {
          this.restart()
        }
      }
      this.updateFallingInstances()
    }

    this.updateMarkers(timestamp, delta)
    this.controls.autoRotate = this.autoRotateEnabled
      && !this.interactionPausedAutoRotate
      && !this.reducedMotion
    this.controls.update(delta / 1000)
    this.renderer.render(this.scene, this.camera)
    this.animationFrame = window.requestAnimationFrame(this.frame)
  }

  private advancePlayback(delta: number): void {
    const initialDelay = this.reducedMotion ? 0 : this.options.playback.initialDelayMs
    if (this.timelineMs < initialDelay) {
      return
    }
    this.stepElapsedMs += delta
    const interval = this.reducedMotion
      ? Math.min(24, this.options.playback.stepIntervalMs)
      : this.options.playback.stepIntervalMs

    while (this.stepElapsedMs >= interval && !this.player.done) {
      const stepIndex = this.player.index
      if (!this.player.next()) {
        break
      }
      const step = this.player.steps[stepIndex]
      if (!step) {
        break
      }
      for (const event of generationStepToVisualEvents(step, this.discoveredCells)) {
        this.consumeVisualEvent(event)
      }
      this.stepElapsedMs -= interval
      this.callbacks.onProgress?.(
        this.discoveredCells.size / this.maskGrid.activeCellCount,
      )
    }

    if (this.player.done && this.fallingInstances.length === 0) {
      this.completed = true
      this.completionElapsedMs = 0
      // Instance matrices change throughout the drop animation. Recompute the
      // aggregate bounds once everything has landed so Three.js raycasting can
      // reliably reach every visible cell.
      this.blockMesh.computeBoundingBox()
      this.blockMesh.computeBoundingSphere()
      this.callbacks.onProgress?.(1)
      this.callbacks.onComplete?.()
      if (this.options.interaction.enabled) {
        this.prepareSolutionSelection()
      }
    }
  }

  private consumeVisualEvent(event: MazeVisualEvent): void {
    if (event.type === 'discover-cell') {
      this.dropCell(event.point.x, event.point.y, event.cellId)
      return
    }
    this.dropConnector(event)
  }

  private dropCell(x: number, y: number, key: string): void {
    const options = this.options.blocks
    const pieceHeight = (
      options.totalHeight - options.layerGap * (options.piecesPerCell - 1)
    ) / options.piecesPerCell
    const width = options.cellSize - options.cellGap
    const color = new THREE.Color(this.getCellColor(x, y))
    for (let layer = 0; layer < options.piecesPerCell; layer += 1) {
      const targetY = pieceHeight / 2 + layer * (pieceHeight + options.layerGap)
      const index = this.blockCount
      this.blockCount += 1
      this.blockMesh.count = this.blockCount
      this.blockMesh.setColorAt(index, color)
      this.blockCellByInstance[index] = { x, y }
      this.queueDrop({
        delay: layer * this.effectiveDuration(this.options.drop.layerStaggerMs),
        index,
        key: `${key}:${layer}`,
        mesh: this.blockMesh,
        position: new THREE.Vector3(x + 0.5, targetY, y + 0.5),
        scale: new THREE.Vector3(width, pieceHeight, width),
      })
    }
    if (this.blockMesh.instanceColor) {
      this.blockMesh.instanceColor.needsUpdate = true
    }
  }

  private dropConnector(event: Extract<MazeVisualEvent, { type: 'connect-cells' }>): void {
    const dz = event.to.y - event.from.y
    const horizontal = dz === 0
    const options = this.options.blocks
    const blockWidth = options.cellSize - options.cellGap
    // The connector occupies only the empty space between two inset cells.
    // Its cross-section matches the cell tower, so the three pieces meet
    // edge-to-edge without the connector overlapping the top of either cell.
    const connectorLength = options.cellGap
    const fromColor = new THREE.Color(this.getCellColor(event.from.x, event.from.y))
    const toColor = new THREE.Color(this.getCellColor(event.to.x, event.to.y))
    const color = this.options.colors.connectorMode === 'source'
      ? fromColor
      : this.options.colors.connectorMode === 'destination'
        ? toColor
        : fromColor.clone().lerp(toColor, 0.5)
    const index = this.connectorCount
    this.connectorCount += 1
    this.connectorMesh.count = this.connectorCount
    this.connectorMesh.setColorAt(index, color)
    if (this.connectorMesh.instanceColor) {
      this.connectorMesh.instanceColor.needsUpdate = true
    }
    this.queueDrop({
      delay: this.effectiveDuration(options.connectorDelayMs),
      index,
      key: `${event.fromId}>${event.toId}`,
      mesh: this.connectorMesh,
      position: new THREE.Vector3(
        (event.from.x + event.to.x) / 2 + 0.5,
        options.connectorHeight / 2,
        (event.from.y + event.to.y) / 2 + 0.5,
      ),
      scale: new THREE.Vector3(
        horizontal ? connectorLength : blockWidth,
        options.connectorHeight,
        horizontal ? blockWidth : connectorLength,
      ),
    })
  }

  private queueDrop(options: {
    delay: number
    index: number
    key: string
    mesh: THREE.InstancedMesh
    position: THREE.Vector3
    scale: THREE.Vector3
  }): void {
    const randomA = hashUnit(`${this.generationSeed}:${options.key}:height`)
    const randomB = hashUnit(`${this.generationSeed}:${options.key}:duration`)
    const randomC = hashUnit(`${this.generationSeed}:${options.key}:rotation`)
    const duration = this.effectiveDuration(
      this.options.drop.durationMs
      + (randomB - 0.5) * this.options.drop.durationVarianceMs * 2,
    )
    const startY = options.position.y
      + this.options.drop.spawnHeight
      + randomA * this.options.drop.spawnHeightVariance
    const rotation = this.options.drop.rotation && !this.reducedMotion
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (randomA - 0.5) * 0.22,
          (randomC - 0.5) * 0.46,
          (randomB - 0.5) * 0.22,
        ))
      : IDENTITY_ROTATION.clone()
    const instance: FallingInstance = {
      duration,
      index: options.index,
      mesh: options.mesh,
      position: options.position,
      rotation,
      scale: options.scale,
      startTime: this.timelineMs + options.delay,
      startY,
    }
    this.fallingInstances.push(instance)
    this.writeInstance(instance, 0)
  }

  private updateFallingInstances(): void {
    let blockChanged = false
    let connectorChanged = false
    this.fallingInstances = this.fallingInstances.filter((instance) => {
      const rawProgress = (this.timelineMs - instance.startTime) / instance.duration
      const progress = THREE.MathUtils.clamp(rawProgress, 0, 1)
      this.writeInstance(instance, progress)
      if (instance.mesh === this.blockMesh) {
        blockChanged = true
      }
      else {
        connectorChanged = true
      }
      return rawProgress < 1
    })
    if (blockChanged) {
      this.blockMesh.instanceMatrix.needsUpdate = true
    }
    if (connectorChanged) {
      this.connectorMesh.instanceMatrix.needsUpdate = true
    }
  }

  private writeInstance(instance: FallingInstance, progress: number): void {
    const eased = ease(progress, this.options.drop.easing)
    const position = instance.position.clone()
    position.y = THREE.MathUtils.lerp(instance.startY, instance.position.y, eased)
    const landingPhase = THREE.MathUtils.clamp((progress - 0.78) / 0.22, 0, 1)
    const compression = 1
      - Math.sin(landingPhase * Math.PI) * this.options.drop.landingCompression
    const scale = instance.scale.clone()
    scale.y *= compression
    const rotation = instance.rotation.clone().slerp(IDENTITY_ROTATION, eased)
    const matrix = new THREE.Matrix4().compose(position, rotation, scale)
    instance.mesh.setMatrixAt(instance.index, matrix)
  }

  private prepareSolutionSelection(): void {
    this.playing = false
    this.callbacks.onPlayingChange?.(false)
    this.solutionStart = pickActiveCell(
      this.maskGrid.mask,
      hashUnit(`${this.generationSeed}:solution-start`),
    )
    this.startMarker = this.createStartMarker(this.solutionStart, true)
    this.solutionGroup.add(this.startMarker)
    this.phase = 'selecting'
    this.solutionPhaseStartedAt = performance.now()
    this.renderer.domElement.style.cursor = 'crosshair'
    this.callbacks.onPhaseChange?.('selecting')
  }

  private startSolution(end: MazePoint): void {
    if (!this.solutionStart || samePoint(this.solutionStart, end)) {
      return
    }

    const solver = this.maze.solve('a-star', {
      end,
      start: this.solutionStart,
    })
    solver.finish()
    const result = this.maze.getSolveResult()
    if (!result?.solved || result.path.length < 2) {
      return
    }

    this.clearSolutionPath()
    this.solutionPath = [...result.path]
    this.endMarker = this.createEndMarker(end, true)
    this.solutionGroup.add(this.endMarker)
    this.createSolutionPath()
    this.solutionProgress = 0
    this.pathMaterial.uniforms.revealProgress!.value = 0
    this.solutionPhaseStartedAt = performance.now()
    this.phase = 'solving'
    this.playing = true
    this.hideHoverMarker()
    this.renderer.domElement.style.cursor = ''
    this.callbacks.onProgress?.(0)
    this.callbacks.onPhaseChange?.('solving')
    this.callbacks.onPlayingChange?.(true)
  }

  private beginStartSelection(): void {
    this.clearSolutionPath()
    this.playing = false
    this.phase = 'selecting-start'
    this.setMarkerPadVisible(this.startMarker, true)
    this.solutionPhaseStartedAt = performance.now()
    this.hideHoverMarker()
    this.renderer.domElement.style.cursor = 'crosshair'
    this.callbacks.onProgress?.(1)
    this.callbacks.onPlayingChange?.(false)
    this.callbacks.onPhaseChange?.('selecting-start')
  }

  private selectSolutionStart(point: MazePoint): void {
    this.startMarker?.removeFromParent()
    this.solutionStart = point
    this.startMarker = this.createStartMarker(point, true)
    this.solutionGroup.add(this.startMarker)
    this.phase = 'selecting'
    this.solutionPhaseStartedAt = performance.now()
    this.hideHoverMarker()
    this.renderer.domElement.style.cursor = 'crosshair'
    this.callbacks.onProgress?.(1)
    this.callbacks.onPhaseChange?.('selecting')
  }

  private advanceSolutionPlayback(delta: number): void {
    const duration = Math.max(
      1,
      (this.solutionPath.length - 1) * this.options.solution.stepIntervalMs,
    )
    this.solutionProgress = this.reducedMotion
      ? 1
      : Math.min(1, this.solutionProgress + delta / duration)
    this.pathMaterial.uniforms.revealProgress!.value = this.solutionProgress
    if (this.solutionCurve && this.solutionHead) {
      this.solutionHead.position.copy(
        this.solutionCurve.getPointAt(this.solutionProgress),
      )
    }
    this.callbacks.onProgress?.(this.solutionProgress)

    if (this.solutionProgress >= 1) {
      this.phase = 'solved'
      this.playing = false
      if (this.solutionHead) {
        this.solutionHead.visible = false
      }
      this.solutionPhaseStartedAt = performance.now()
      this.renderer.domElement.style.cursor = 'crosshair'
      this.callbacks.onProgress?.(1)
      this.callbacks.onPlayingChange?.(false)
      this.callbacks.onPhaseChange?.('solved')
    }
  }

  private createSolutionPath(): void {
    const options = this.options.solution
    const routeHeight = this.options.blocks.totalHeight + options.pathOffset
    const points = this.solutionPath.map(point => new THREE.Vector3(
      point.x + 0.5,
      routeHeight,
      point.y + 0.5,
    ))
    this.solutionCurve = createRoundedPathCurve(points, options.cornerRadius)
    const tubularSegments = Math.max(
      24,
      Math.ceil(this.solutionCurve.getLength() * 16),
    )
    this.solutionPathGeometry = new THREE.TubeGeometry(
      this.solutionCurve,
      tubularSegments,
      options.pathRadius,
      10,
      false,
    )
    this.solutionPathMesh = new THREE.Mesh(
      this.solutionPathGeometry,
      this.pathMaterial,
    )
    this.solutionPathMesh.renderOrder = 3
    this.solutionGroup.add(this.solutionPathMesh)

    this.solutionHead = new THREE.Mesh(
      this.pathHeadGeometry,
      this.pathHeadMaterial,
    )
    this.solutionHead.scale.setScalar(options.pathRadius * 1.55)
    this.solutionHead.position.copy(this.solutionCurve.getPointAt(0))
    this.solutionHead.renderOrder = 4
    this.solutionGroup.add(this.solutionHead)
  }

  private createStartMarker(point: MazePoint, dropOnCreate = false): THREE.Group {
    const options = this.options.solution
    const marker = this.createMarkerBase(point)
    const ringGroup = this.createMarkerPad(
      options.markerRingRadius,
      this.startMaterial,
      this.startFillMaterial,
    )

    const drop = this.createMarkerBody(this.startMaterial)
    marker.add(ringGroup, drop)
    marker.userData.ring = ringGroup
    marker.userData.drop = drop
    this.prepareMarkerDrop(marker, dropOnCreate)
    return marker
  }

  private createEndMarker(point: MazePoint, dropOnCreate = false): THREE.Group {
    const options = this.options.solution
    const marker = this.createMarkerBase(point)
    const ring = this.createMarkerPad(
      options.markerRingRadius,
      this.endMaterial,
      this.endFillMaterial,
    )
    const drop = this.createMarkerBody(this.endMaterial)
    marker.add(ring, drop)
    marker.userData.ring = ring
    marker.userData.drop = drop
    this.prepareMarkerDrop(marker, dropOnCreate)
    return marker
  }

  private prepareMarkerDrop(marker: THREE.Group, enabled: boolean): void {
    if (!enabled || this.reducedMotion) {
      this.setMarkerPadVisible(marker, false)
      return
    }
    this.setMarkerPadVisible(marker, true)
    const drop = marker.userData.drop as THREE.Group
    drop.position.y = this.options.solution.markerPreviewLift
    marker.userData.dropStartedAt = performance.now()
  }

  private createMarkerBase(point: MazePoint): THREE.Group {
    const marker = new THREE.Group()
    marker.position.set(
      point.x + 0.5,
      this.options.blocks.totalHeight + this.options.solution.pathOffset,
      point.y + 0.5,
    )
    marker.renderOrder = 4
    return marker
  }

  private createMarkerBody(material: THREE.Material): THREE.Group {
    const body = new THREE.Group()
    const surface = new THREE.Mesh(this.markerBodyGeometry, material)
    surface.renderOrder = 5
    body.add(surface)
    body.userData.surface = surface
    body.renderOrder = 4
    return body
  }

  private createMarkerPad(
    radius: number,
    ringMaterial: THREE.Material,
    fillMaterial: THREE.Material,
  ): THREE.Group {
    const pad = new THREE.Group()
    const fill = new THREE.Mesh(this.markerFillGeometry, fillMaterial)
    fill.rotation.x = -Math.PI / 2
    fill.scale.setScalar(radius)
    fill.position.y = 0.002
    fill.renderOrder = 4
    const ring = this.createRing(radius, ringMaterial)
    pad.add(fill, ring)
    pad.userData.fill = fill
    pad.userData.ring = ring
    return pad
  }

  private createRing(radius: number, material: THREE.Material): THREE.Mesh {
    const ring = new THREE.Mesh(this.markerRingGeometry, material)
    ring.rotation.x = Math.PI / 2
    ring.scale.setScalar(radius)
    ring.renderOrder = 4
    return ring
  }

  private updateMarkers(timestamp: number, delta: number): void {
    if (this.startMarker) {
      const wave = (Math.sin(timestamp / 260) + 1) / 2
      const ring = this.startMarker.userData.ring as THREE.Group
      const drop = this.startMarker.userData.drop as THREE.Group
      const pulse = (
        this.phase === 'selecting' || this.phase === 'selecting-start'
      ) && !this.reducedMotion
        ? 1 + wave * 0.22
        : 1
      ring.scale.set(pulse, pulse, pulse)
      const bob = (
        this.phase === 'selecting' || this.phase === 'selecting-start'
      ) && !this.reducedMotion
        ? Math.sin(timestamp / 360) * 0.018
        : 0
      const selectedLift = this.phase === 'selecting-start'
        ? this.options.solution.markerSelectedLift
        : 0
      if (!this.updateMarkerDrop(this.startMarker, timestamp)) {
        drop.position.y = THREE.MathUtils.damp(
          drop.position.y,
          selectedLift + bob,
          12,
          delta / 1000,
        )
      }
    }

    if (this.endMarker) {
      const age = Math.max(0, timestamp - this.solutionPhaseStartedAt)
      const pulse = this.reducedMotion || age > 520
        ? 1
        : 1 + Math.sin((age / 520) * Math.PI) * 0.35
      const ring = this.endMarker.userData.ring as THREE.Group
      ring.scale.set(pulse, pulse, pulse)
      this.updateMarkerDrop(this.endMarker, timestamp)
    }
  }

  private updateMarkerDrop(marker: THREE.Group, timestamp: number): boolean {
    const startedAt = marker.userData.dropStartedAt as number | undefined
    if (startedAt === undefined) {
      return false
    }
    const duration = Math.max(1, this.options.solution.markerDropDurationMs)
    const progress = THREE.MathUtils.clamp((timestamp - startedAt) / duration, 0, 1)
    const eased = 1 - (1 - progress) ** 3
    const drop = marker.userData.drop as THREE.Group
    drop.position.y = this.options.solution.markerPreviewLift * (1 - eased)
    if (progress >= 1) {
      delete marker.userData.dropStartedAt
      this.setMarkerPadVisible(marker, false)
    }
    return true
  }

  private setMarkerPadVisible(marker: THREE.Group | null, visible: boolean): void {
    const pad = marker?.userData.ring as THREE.Group | undefined
    if (pad) {
      pad.visible = visible
    }
  }

  private clearSolutionPath(): void {
    this.solutionPathMesh?.removeFromParent()
    this.solutionHead?.removeFromParent()
    this.solutionPathGeometry?.dispose()
    this.solutionCurve = null
    this.solutionPathMesh = null
    this.solutionPathGeometry = null
    this.solutionHead = null
    this.endMarker?.removeFromParent()
    this.endMarker = null
    this.solutionPath = []
    this.solutionProgress = 0
  }

  private clearSolution(): void {
    this.solutionGroup.clear()
    this.solutionPathGeometry?.dispose()
    this.solutionCurve = null
    this.solutionPathMesh = null
    this.solutionPathGeometry = null
    this.solutionHead = null
    this.startMarker = null
    this.endMarker = null
    this.hoverMarker = null
    this.solutionStart = null
    this.solutionPath = []
    this.solutionProgress = 0
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.completed || !this.options.interaction.enabled) {
      return
    }
    this.pointerStart = {
      marker: this.pickMarkerTarget(event),
      x: event.clientX,
      y: event.clientY,
    }
    if (this.options.interaction.pauseAutoRotateOnInteract) {
      this.interactionPausedAutoRotate = true
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.completed || !this.options.interaction.enabled) {
      return
    }
    const surfaceMarker = this.pickMarkerSurface(event)
    const point = this.pickCell(event)
    const hoveredMarker = surfaceMarker
      ?? (point ? this.getMarkerAtPoint(point) : null)
    if (hoveredMarker === 'start') {
      this.setStartMarkerHover(true)
      this.hideCandidateMarker()
      this.renderer.domElement.style.cursor = 'pointer'
      return
    }
    this.setStartMarkerHover(false)
    if (hoveredMarker === 'end') {
      this.hideCandidateMarker()
      this.renderer.domElement.style.cursor = 'pointer'
      return
    }
    if (!point) {
      this.hideHoverMarker()
      return
    }
    if (this.phase === 'solving') {
      this.hideCandidateMarker()
      return
    }
    this.showHoverMarker(point)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerStart || !this.completed || !this.options.interaction.enabled) {
      this.pointerStart = null
      return
    }
    const pointerStart = this.pointerStart
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    )
    this.pointerStart = null
    if (distance > this.options.interaction.pointerMoveThreshold) {
      return
    }
    const marker = pointerStart.marker ?? this.pickMarkerTarget(event)
    if (marker === 'start' && this.solutionStart) {
      if (this.phase === 'selecting-start') {
        this.selectSolutionStart(this.solutionStart)
      }
      else {
        this.beginStartSelection()
      }
      return
    }
    if (marker === 'end') {
      return
    }
    const point = this.pickCell(event)
    if (!point) {
      return
    }
    if (this.phase === 'selecting-start') {
      this.selectSolutionStart(point)
      return
    }
    if (this.solutionStart && samePoint(point, this.solutionStart)) {
      this.beginStartSelection()
      return
    }
    this.startSolution(point)
  }

  private readonly onPointerLeave = (): void => {
    this.pointerStart = null
    this.hideHoverMarker()
  }

  private pickCell(event: PointerEvent): MazePoint | null {
    if (!this.updateRaycaster(event)) {
      return null
    }
    const hit = this.raycaster.intersectObject(this.blockMesh, false)[0]
    if (hit?.instanceId === undefined) {
      return null
    }
    const point = this.blockCellByInstance[hit.instanceId]
    return point ? { ...point } : null
  }

  private pickMarkerCell(event: PointerEvent): 'end' | 'start' | null {
    const point = this.pickCell(event)
    return point ? this.getMarkerAtPoint(point) : null
  }

  private pickMarkerSurface(event: PointerEvent): 'end' | 'start' | null {
    if (!this.updateRaycaster(event)) {
      return null
    }
    const startHit = this.startMarker
      ? this.raycaster.intersectObject(this.startMarker, true)[0]
      : undefined
    const endHit = this.endMarker
      ? this.raycaster.intersectObject(this.endMarker, true)[0]
      : undefined
    if (startHit && (!endHit || startHit.distance <= endHit.distance)) {
      return 'start'
    }
    return endHit ? 'end' : null
  }

  private pickMarkerTarget(event: PointerEvent): 'end' | 'start' | null {
    return this.pickMarkerSurface(event) ?? this.pickMarkerCell(event)
  }

  private getMarkerAtPoint(point: MazePoint): 'end' | 'start' | null {
    if (this.solutionStart && samePoint(point, this.solutionStart)) {
      return 'start'
    }
    const end = this.solutionPath[this.solutionPath.length - 1]
    return end && samePoint(point, end) ? 'end' : null
  }

  private updateRaycaster(event: PointerEvent): boolean {
    const bounds = this.renderer.domElement.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) {
      return false
    }
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return true
  }

  private showHoverMarker(point: MazePoint): void {
    if (!this.hoverMarker) {
      this.hoverMarker = this.createMarkerBase(point)
      const ring = this.createRing(
        this.options.solution.hoverRingRadius,
        this.endHoverMaterial,
      )
      const fill = new THREE.Mesh(
        this.markerFillGeometry,
        this.endHoverFillMaterial,
      )
      fill.rotation.x = -Math.PI / 2
      fill.scale.setScalar(this.options.solution.hoverRingRadius)
      fill.position.y = 0.002
      fill.renderOrder = 4
      const drop = this.createMarkerBody(this.endMaterial)
      drop.position.y = this.options.solution.markerPreviewLift
      this.hoverMarker.add(fill, ring, drop)
      this.hoverMarker.userData.ring = ring
      this.hoverMarker.userData.fill = fill
      this.hoverMarker.userData.drop = drop
      this.solutionGroup.add(this.hoverMarker)
    }
    const selectingStart = this.phase === 'selecting-start'
    const ring = this.hoverMarker.userData.ring as THREE.Mesh
    const fill = this.hoverMarker.userData.fill as THREE.Mesh
    const drop = this.hoverMarker.userData.drop as THREE.Group
    const surface = drop.userData.surface as THREE.Mesh
    ring.material = selectingStart
      ? this.startHoverMaterial
      : this.endHoverMaterial
    fill.material = selectingStart
      ? this.startHoverFillMaterial
      : this.endHoverFillMaterial
    surface.material = selectingStart ? this.startMaterial : this.endMaterial
    drop.position.y = this.options.solution.markerPreviewLift
    this.hoverMarker.position.set(
      point.x + 0.5,
      this.options.blocks.totalHeight + this.options.solution.pathOffset,
      point.y + 0.5,
    )
    this.hoverMarker.visible = true
    this.renderer.domElement.style.cursor = 'pointer'
  }

  private hideHoverMarker(): void {
    this.hideCandidateMarker()
    this.setStartMarkerHover(false)
    if (this.completed) {
      this.renderer.domElement.style.cursor = 'crosshair'
    }
  }

  private hideCandidateMarker(): void {
    if (this.hoverMarker) {
      this.hoverMarker.visible = false
    }
  }

  private setStartMarkerHover(hovered: boolean): void {
    const drop = this.startMarker?.userData.drop as THREE.Group | undefined
    const surface = drop?.userData.surface as THREE.Mesh | undefined
    const pad = this.startMarker?.userData.ring as THREE.Group | undefined
    const ring = pad?.userData.ring as THREE.Mesh | undefined
    const fill = pad?.userData.fill as THREE.Mesh | undefined
    if (surface) {
      surface.material = hovered
        ? this.startBodyHoverMaterial
        : this.startMaterial
    }
    if (ring) {
      ring.material = hovered
        ? this.startMarkerHoverMaterial
        : this.startMaterial
    }
    if (fill) {
      fill.material = hovered
        ? this.startMarkerHoverFillMaterial
        : this.startFillMaterial
    }
  }

  private effectiveDuration(duration: number): number {
    return this.reducedMotion ? Math.max(1, duration * 0.12) : duration
  }

  private getCellColor(x: number, y: number): string {
    return this.maskGrid.colors[y]?.[x]
      ?? (y < this.options.maze.rows * 0.58
        ? this.options.colors.secondary
        : this.options.colors.primary)
  }

  private resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) {
      return
    }
    const mobile = width < this.options.performance.mobileBreakpoint
    const maxPixelRatio = mobile
      ? this.options.performance.mobileMaxPixelRatio
      : this.options.performance.maxPixelRatio
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio)
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.fitCamera()
  }

  private fitCamera(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) {
      return
    }
    const mobile = width < this.options.performance.mobileBreakpoint
    const bounds = mobile ? getMaskBounds(this.maskGrid.mask) : null
    const mazeWidth = bounds?.width ?? this.options.maze.cols
    const mazeHeight = bounds?.height ?? this.options.maze.rows
    const distanceScale = mobile ? 1.1 : 1.25
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov)
    const visibleHeight = 2 * Math.tan(verticalFov / 2)
    const visibleWidth = visibleHeight * this.camera.aspect
    const distance = Math.max(
      mazeWidth / (visibleWidth * (mobile ? 0.86 : 0.76)),
      mazeHeight / (visibleHeight * (mobile ? 0.86 : 0.76)),
    ) * distanceScale
    const direction = new THREE.Vector3(0, 0.88, 1).normalize()
    const target = new THREE.Vector3(
      bounds ? bounds.centerX - this.options.maze.cols / 2 : 0,
      this.options.blocks.totalHeight * 0.3,
      bounds ? bounds.centerY - this.options.maze.rows / 2 : 0,
    )
    this.camera.position.copy(target).add(direction.multiplyScalar(distance))
    this.controls.target.copy(target)
    this.controls.minDistance = Math.max(5, distance * 0.38)
    this.controls.maxDistance = distance * 3.5
    this.controls.update()
  }
}

function getMaskBounds(mask: readonly (readonly boolean[])[]): {
  centerX: number
  centerY: number
  height: number
  width: number
} | null {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (let y = 0; y < mask.length; y += 1) {
    for (let x = 0; x < (mask[y]?.length ?? 0); x += 1) {
      if (!mask[y]![x]) {
        continue
      }
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  if (!Number.isFinite(minX)) {
    return null
  }
  return {
    centerX: (minX + maxX + 1) / 2,
    centerY: (minY + maxY + 1) / 2,
    height: maxY - minY + 1,
    width: maxX - minX + 1,
  }
}

function ease(progress: number, easing: MazeVisualizationOptions['drop']['easing']): number {
  if (easing === 'easeOutCubic') {
    return 1 - (1 - progress) ** 3
  }
  if (easing === 'easeOutBack') {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (progress - 1) ** 3 + c1 * (progress - 1) ** 2
  }
  const n1 = 7.5625
  const d1 = 2.75
  if (progress < 1 / d1) {
    return n1 * progress * progress
  }
  if (progress < 2 / d1) {
    const shifted = progress - 1.5 / d1
    return n1 * shifted * shifted + 0.75
  }
  if (progress < 2.5 / d1) {
    const shifted = progress - 2.25 / d1
    return n1 * shifted * shifted + 0.9375
  }
  const shifted = progress - 2.625 / d1
  return n1 * shifted * shifted + 0.984375
}

function hashUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function createRandomSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random()}`
}

function createLightMaterial(
  color: string,
  intensity: number,
  opacity = 1,
): THREE.MeshBasicMaterial {
  const lightColor = new THREE.Color(color).multiplyScalar(intensity)
  return new THREE.MeshBasicMaterial({
    color: lightColor,
    depthWrite: false,
    opacity,
    toneMapped: false,
    transparent: opacity < 1,
  })
}

function createFillMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    opacity,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  })
}

function createMarkerMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.04,
    roughness: 0.3,
  })
}

function createPathMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    fragmentShader: `
      uniform vec3 lightColor;
      uniform float revealProgress;
      varying float pathProgress;

      void main() {
        if (pathProgress > revealProgress) {
          discard;
        }
        gl_FragColor = vec4(lightColor, 1.0);
      }
    `,
    uniforms: {
      lightColor: {
        value: new THREE.Color(color),
      },
      revealProgress: { value: 0 },
    },
    vertexShader: `
      varying float pathProgress;

      void main() {
        pathProgress = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  })
}

function createMarkerBodyGeometry(
  ballRadius: number,
  coneHeight: number,
): THREE.LatheGeometry {
  // Solve the sphere/cone tangent intersection so both sections share not
  // only a vertex ring but also the same surface direction at their join.
  const radiusToHeight = ballRadius / coneHeight
  const joinSin = (
    Math.sqrt(1 + 4 * radiusToHeight * radiusToHeight) - 1
  ) / (2 * radiusToHeight)
  const joinAngle = -Math.asin(joinSin)
  const joinRadius = ballRadius * Math.cos(joinAngle)
  const sphereCenterY = coneHeight - ballRadius * Math.sin(joinAngle)
  const points = [new THREE.Vector2(0, 0)]

  // Extra points keep the long tapered section smooth without separating it
  // into a second mesh.
  for (let step = 1; step <= 4; step += 1) {
    const progress = step / 4
    points.push(new THREE.Vector2(
      joinRadius * progress,
      coneHeight * progress,
    ))
  }

  const sphereSegments = 14
  for (let step = 1; step <= sphereSegments; step += 1) {
    const progress = step / sphereSegments
    const angle = THREE.MathUtils.lerp(joinAngle, Math.PI / 2, progress)
    points.push(new THREE.Vector2(
      ballRadius * Math.cos(angle),
      sphereCenterY + ballRadius * Math.sin(angle),
    ))
  }

  const geometry = new THREE.LatheGeometry(points, 32)
  geometry.computeVertexNormals()
  return geometry
}

function createRoundedPathCurve(
  points: THREE.Vector3[],
  cornerRadius: number,
): THREE.Curve<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>()
  if (points.length < 3) {
    path.add(new THREE.LineCurve3(points[0]!, points[points.length - 1]!))
    return path
  }

  let cursor = points[0]!.clone()
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!
    const current = points[index]!
    const next = points[index + 1]!
    const entry = moveToward(current, previous, cornerRadius)
    const exit = moveToward(current, next, cornerRadius)
    path.add(new THREE.LineCurve3(cursor, entry))
    path.add(new THREE.QuadraticBezierCurve3(entry, current, exit))
    cursor = exit
  }
  path.add(new THREE.LineCurve3(cursor, points[points.length - 1]!))
  return path
}

function moveToward(
  from: THREE.Vector3,
  to: THREE.Vector3,
  distance: number,
): THREE.Vector3 {
  const direction = to.clone().sub(from)
  const availableDistance = direction.length()
  return from.clone().add(
    direction.normalize().multiplyScalar(Math.min(distance, availableDistance / 2)),
  )
}

function samePoint(a: MazePoint, b: MazePoint): boolean {
  return a.x === b.x && a.y === b.y
}

export function generationStepToVisualEvents(
  step: MazeGenerationStep,
  discoveredCells: Set<string>,
): MazeVisualEvent[] {
  if (step.type === 'visit') {
    return discover(step.payload.to, discoveredCells)
  }
  if (step.type !== 'carve') {
    return []
  }

  const fromId = step.payload.from
  const toId = step.payload.to
  if (!fromId) {
    return discover(toId, discoveredCells)
  }
  return [
    ...discover(fromId, discoveredCells),
    ...discover(toId, discoveredCells),
    {
      from: cellIdToPoint(fromId),
      fromId,
      to: cellIdToPoint(toId),
      toId,
      type: 'connect-cells',
    },
  ]
}

function discover(cellId: string, discoveredCells: Set<string>): MazeVisualEvent[] {
  if (discoveredCells.has(cellId)) {
    return []
  }
  discoveredCells.add(cellId)
  return [{ cellId, point: cellIdToPoint(cellId), type: 'discover-cell' }]
}
