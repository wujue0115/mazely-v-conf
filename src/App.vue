<script setup lang="ts">
import type { AnimationSpeed, MaskId, MazeAlgorithm, MazeSize } from '@/mazely/config'
import type { MazeRenderer, MazeRendererPhase } from '@/mazely/renderer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { ANIMATION_SPEED_PRESETS, ANIMATION_SPEEDS, DEFAULT_VISUALIZATION_OPTIONS, MASK_IDS, MASK_PRESETS, MAZE_SIZES } from '@/mazely/config'
import { loadImageMask } from '@/mazely/mask'

type ViewStatus = 'loading' | MazeRendererPhase | 'fallback' | 'error'

const stage = useTemplateRef<HTMLElement>('stage')
const selectedAlgorithm = ref<MazeAlgorithm>('recursive-backtracker')
const activeMaskId = ref<MaskId>('vue')
const activePreset = computed(() => MASK_PRESETS[activeMaskId.value])
const maskSource = computed(() => assetSource(activePreset.value.source))
const themeStyle = computed(() => ({
  '--theme-on-primary': activePreset.value.colors.onPrimary,
  '--theme-primary': activePreset.value.colors.primary,
  '--theme-secondary': activePreset.value.colors.secondary,
}))
const vConfIconSource = `${import.meta.env.BASE_URL}vuejs-taiwan.png`
const mazelyIconSource = `${import.meta.env.BASE_URL}mazely-logo.svg`
const appVersion = __APP_VERSION__
const status = ref<ViewStatus>('loading')
const isPlaying = ref(true)
const rendererReady = ref(false)
const autoRotate = ref(DEFAULT_VISUALIZATION_OPTIONS.camera.autoRotate)
const routeSelectionEnabled = ref(DEFAULT_VISUALIZATION_OPTIONS.interaction.enabled)
const settingsOpen = ref(false)
const settingsDialog = useTemplateRef<HTMLDialogElement>('settingsDialog')
const piecesPerCell = ref(DEFAULT_VISUALIZATION_OPTIONS.blocks.piecesPerCell)
const blockHeight = ref(
  DEFAULT_VISUALIZATION_OPTIONS.blocks.totalHeight
  / DEFAULT_VISUALIZATION_OPTIONS.blocks.piecesPerCell,
)
const blockSize = ref(
  DEFAULT_VISUALIZATION_OPTIONS.blocks.cellSize
  - DEFAULT_VISUALIZATION_OPTIONS.blocks.cellGap,
)
const mazeSize = ref<MazeSize>('small')
const animationSpeed = ref<AnimationSpeed>('slow')
const progress = ref(0)
const errorMessage = ref('')
const playbackDisabled = computed(() => !rendererReady.value)
const routeHint = computed(() => {
  if (status.value === 'selecting-start') {
    return 'Select a new start point'
  }
  if (status.value === 'selecting') {
    return 'Select a destination'
  }
  if (status.value === 'solved') {
    return 'Select another destination'
  }
  return ''
})
let renderer: MazeRenderer | null = null
let rendererBuild = 0

onMounted(() => {
  void rebuildVisualization()
})

async function rebuildVisualization(): Promise<void> {
  if (!stage.value || typeof window.WebGLRenderingContext === 'undefined') {
    status.value = 'fallback'
    return
  }

  const build = ++rendererBuild
  rendererReady.value = false
  status.value = 'loading'
  progress.value = 0
  errorMessage.value = ''
  try {
    const options = structuredClone(DEFAULT_VISUALIZATION_OPTIONS)
    const dimensions = activePreset.value.sizes[mazeSize.value]
    options.maze.algorithm = selectedAlgorithm.value
    options.maze.cols = dimensions.cols
    options.maze.rows = dimensions.rows
    const timing = ANIMATION_SPEED_PRESETS[animationSpeed.value]
    options.playback.stepIntervalMs = timing.stepIntervalMs
    options.solution.stepIntervalMs = timing.solutionStepIntervalMs
    options.blocks.piecesPerCell = piecesPerCell.value
    options.blocks.totalHeight = blockHeight.value * piecesPerCell.value
    options.blocks.connectorHeight = options.blocks.totalHeight
    options.blocks.cellGap = options.blocks.cellSize - blockSize.value
    options.blocks.connectorWidth = blockSize.value
    options.blocks.connectorDelayMs = timing.connectorDelayMs
    options.drop.durationMs = timing.dropDurationMs
    options.drop.durationVarianceMs = timing.dropDurationVarianceMs
    options.drop.layerStaggerMs = timing.layerStaggerMs
    options.camera.autoRotate = autoRotate.value
    options.interaction.enabled = routeSelectionEnabled.value
    options.playback.loop = !routeSelectionEnabled.value
    options.colors.primary = activePreset.value.colors.primary
    options.colors.secondary = activePreset.value.colors.secondary
    const maskGrid = await loadImageMask(
      maskSource.value,
      options.maze.cols,
      options.maze.rows,
      activePreset.value.sampling,
    )
    if (build !== rendererBuild || !stage.value) {
      return
    }
    const { MazeRenderer } = await import('@/mazely/renderer')
    if (build !== rendererBuild || !stage.value) {
      return
    }
    renderer?.dispose()
    renderer = null
    renderer = new MazeRenderer(stage.value, maskGrid, options, {
      onPhaseChange: (phase) => {
        status.value = phase
        if (
          phase === 'selecting'
          || phase === 'selecting-start'
          || phase === 'solved'
        ) {
          progress.value = 1
        }
        else if (phase === 'solving') {
          progress.value = 0
        }
      },
      onPlayingChange: (playing) => {
        isPlaying.value = playing
      },
      onProgress: (nextProgress) => {
        progress.value = nextProgress
      },
    })
    rendererReady.value = true
    status.value = 'generating'
  }
  catch (error) {
    if (build !== rendererBuild) {
      return
    }
    console.error(error)
    rendererReady.value = false
    errorMessage.value = error instanceof Error ? error.message : 'Unknown rendering error'
    status.value = 'error'
  }
}

onBeforeUnmount(() => {
  rendererBuild += 1
  renderer?.dispose()
  renderer = null
  rendererReady.value = false
})

function togglePlayback(): void {
  renderer?.toggle()
}

function regenerate(): void {
  progress.value = 0
  status.value = 'generating'
  renderer?.regenerate()
}

function changeAlgorithm(): void {
  progress.value = 0
  status.value = 'generating'
  renderer?.setAlgorithm(selectedAlgorithm.value)
}

function toggleAutoRotate(): void {
  autoRotate.value = !autoRotate.value
  renderer?.setAutoRotate(autoRotate.value)
}

function toggleRouteSelection(): void {
  routeSelectionEnabled.value = !routeSelectionEnabled.value
  void rebuildVisualization()
}

function resetView(): void {
  renderer?.resetView()
}

function openSettings(): void {
  settingsOpen.value = true
  void nextTick(() => settingsDialog.value?.focus())
}

function closeSettings(): void {
  settingsOpen.value = false
}

function setMazeSize(size: MazeSize): void {
  if (mazeSize.value === size) {
    return
  }
  mazeSize.value = size
  void rebuildVisualization()
}

function setAnimationSpeed(speed: AnimationSpeed): void {
  if (animationSpeed.value === speed) {
    return
  }
  animationSpeed.value = speed
  void rebuildVisualization()
}

function changeBlockSize(): void {
  blockHeight.value = Math.min(blockHeight.value, blockSize.value)
  void rebuildVisualization()
}

function selectMask(maskId: MaskId): void {
  if (activeMaskId.value === maskId) {
    return
  }
  activeMaskId.value = maskId
  void rebuildVisualization()
}

function assetSource(source: string): string {
  return `${import.meta.env.BASE_URL}${source}`
}

</script>

<template>
  <main class="hero" :style="themeStyle">
    <h1 class="visually-hidden">
      V-CONF × Mazely — Interactive 3D Vue and Vite Logo Mazes
    </h1>

    <nav class="mask-switcher" aria-label="Maze masks">
      <button
        v-for="maskId in MASK_IDS"
        :key="maskId"
        type="button"
        :class="{ 'is-active': activeMaskId === maskId }"
        :aria-label="`Show ${MASK_PRESETS[maskId].label} maze`"
        :aria-pressed="activeMaskId === maskId"
        @click="selectMask(maskId)"
      >
        <span class="mask-switcher__preview">
          <img :src="assetSource(MASK_PRESETS[maskId].source)" alt="">
        </span>
        <span>{{ MASK_PRESETS[maskId].label }}</span>
      </button>
    </nav>

    <header class="topbar">
      <nav class="site-links" aria-label="Project links">
        <a href="https://v-conf.vue.tw/" target="_blank" rel="noreferrer">
          <img :src="vConfIconSource" alt="">
          <span>V-Conf</span>
        </a>
        <a href="https://mazely.dev" target="_blank" rel="noreferrer">
          <img :src="mazelyIconSource" alt="">
          <span>Mazely</span>
        </a>
        <a
          href="https://github.com/wujue0115/mazely-v-conf"
          target="_blank"
          rel="noreferrer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M0 0h24v24H0z" fill="none" />
            <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
          </svg>
          <span>GitHub</span>
        </a>
      </nav>
    </header>

    <section class="visual" :aria-label="`Interactive ${activePreset.label} logo maze visualization`">
      <div ref="stage" class="stage">
        <img
          v-if="status === 'fallback' || status === 'error'"
          class="fallback-logo"
          :src="maskSource"
          :alt="`${activePreset.label} logo`"
        >
        <div v-if="status === 'loading'" class="loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <p v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </p>
    </section>

    <p
      v-if="routeHint"
      class="route-hint"
      aria-live="polite"
    >
      {{ routeHint }}
    </p>

    <div class="playback-dock" aria-label="Maze controls">
      <div class="playback-cluster">
        <button
          class="bar-btn"
          type="button"
          title="Visualization settings"
          aria-label="Open visualization settings"
          @click="openSettings"
        >
          <svg class="bar-btn__stroke" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
          </svg>
        </button>
        <button
          class="bar-btn bar-btn--toggle"
          :class="{ 'is-active': routeSelectionEnabled }"
          type="button"
          :disabled="!rendererReady"
          title="Route selection"
          aria-label="Route selection"
          :aria-pressed="routeSelectionEnabled"
          @click="toggleRouteSelection"
        >
          <svg class="bar-btn__stroke bar-btn__icon--large bar-btn__icon--route" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6.5" cy="17.5" r="2" />
            <circle cx="17.5" cy="6.5" r="2" />
            <path d="M8.5 17.5H11a1 1 0 0 0 1-1v-9a1 1 0 0 1 1-1h2.5" />
          </svg>
        </button>
        <button
          class="bar-btn bar-btn--toggle"
          :class="{ 'is-active': autoRotate }"
          type="button"
          :disabled="!rendererReady"
          title="Automatic rotation"
          aria-label="Automatic rotation"
          :aria-pressed="autoRotate"
          @click="toggleAutoRotate"
        >
          <svg class="bar-btn__stroke bar-btn__icon--large" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 8 3 1.7v3.6L12 15l-3-1.7V9.7L12 8Z" />
            <path d="M12 11.5 9 9.7m3 1.8 3-1.8m-3 1.8V15" />
            <path d="M2.8 10.5c.8-3.8 4.6-6.4 9.2-6.4 5.1 0 9.2 3.1 9.2 6.4" />
            <path d="m17.8 8.2 3.4 2.3 1.2-3.5" />
            <path d="M21.2 13.5c-.8 3.8-4.6 6.4-9.2 6.4-5.1 0-9.2-3.1-9.2-6.4" />
            <path d="m6.2 15.8-3.4-2.3L1.6 17" />
          </svg>
        </button>
        <button
          class="bar-btn"
          type="button"
          :disabled="!rendererReady"
          title="Focus maze"
          aria-label="Focus maze"
          @click="resetView"
        >
          <svg class="bar-btn__stroke" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m18 0v3a2 2 0 0 1-2 2h-3m-4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          </svg>
        </button>
        <button
          class="bar-btn"
          type="button"
          :disabled="!rendererReady"
          title="Regenerate"
          aria-label="Regenerate"
          @click="regenerate"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12.05q0 .4.05.788t.175.762q.125.425-.025.813t-.525.562q-.4.2-.787.038t-.513-.588q-.2-.575-.288-1.175T4 12.05q0-3.35 2.325-5.7T12 4h.175l-.9-.9Q11 2.825 11 2.4t.275-.7t.7-.275t.7.275l2.6 2.6q.3.3.3.7t-.3.7l-2.6 2.6q-.275.275-.7.275t-.7-.275T11 7.6t.275-.7l.9-.9H12Q9.5 6 7.75 7.763T6 12.05m12-.1q0-.4-.05-.787t-.175-.763q-.125-.425.025-.812t.525-.563q.4-.2.787-.037t.513.587q.2.575.288 1.175t.087 1.2q0 3.35-2.325 5.7T12 20h-.175l.9.9q.275.275.275.7t-.275.7t-.7.275t-.7-.275l-2.6-2.6q-.3-.3-.3-.7t.3-.7l2.6-2.6q.275-.275.7-.275t.7.275t.275.7t-.275.7l-.9.9H12q2.5 0 4.25-1.762T18 11.95" />
          </svg>
        </button>
        <button
          class="bar-btn bar-btn--primary"
          type="button"
          :disabled="playbackDisabled"
          :title="isPlaying ? 'Pause' : 'Play'"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlayback"
        >
          <svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 19q-.825 0-1.412-.587T14 17V7q0-.825.588-1.412T16 5t1.413.588T18 7v10q0 .825-.587 1.413T16 19m-8 0q-.825 0-1.412-.587T6 17V7q0-.825.588-1.412T8 5t1.413.588T10 7v10q0 .825-.587 1.413T8 19" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712" />
          </svg>
        </button>
      </div>

      <div
        class="playback-progress"
        role="progressbar"
        aria-label="Maze generation progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(progress * 100)"
      >
        <span :style="{ transform: `scaleX(${progress})` }" />
      </div>
    </div>

    <div v-if="settingsOpen" class="dialog-layer" @click.self="closeSettings">
      <dialog
        ref="settingsDialog"
        class="settings-dialog"
        open
        role="dialog"
        aria-labelledby="settings-dialog-title"
        @keydown.esc.prevent="closeSettings"
      >
        <header class="settings-panel__header">
          <h2 id="settings-dialog-title">Visualization</h2>
          <button
            class="collapse-btn"
            type="button"
            aria-label="Close visualization settings"
            @click="closeSettings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
          </button>
        </header>

        <div class="settings-panel__body">
          <section class="field-group">
            <label class="micro-label" for="generation-algorithm">Algorithm</label>
            <select id="generation-algorithm" v-model="selectedAlgorithm" @change="changeAlgorithm">
              <option value="recursive-backtracker">Recursive Backtracker</option>
              <option value="prim">Randomized Prim</option>
              <option value="kruskal">Randomized Kruskal</option>
            </select>
          </section>

          <section class="field-group">
            <label class="micro-label" for="pieces-per-cell">Blocks per cell</label>
            <select
              id="pieces-per-cell"
              v-model.number="piecesPerCell"
              @change="rebuildVisualization()"
            >
              <option v-for="count in 5" :key="count" :value="count">
                {{ count }}
              </option>
            </select>
          </section>

          <section class="field-group">
            <div class="range-heading">
              <label class="micro-label" for="block-height">Block height</label>
              <code>{{ blockHeight.toFixed(2) }}</code>
            </div>
            <input
              id="block-height"
              v-model.number="blockHeight"
              class="setting-range"
              type="range"
              min="0.12"
              :max="blockSize"
              step="0.02"
              @change="rebuildVisualization()"
            >
          </section>

          <section class="field-group">
            <div class="range-heading">
              <label class="micro-label" for="block-size">Block size</label>
              <code>{{ blockSize.toFixed(2) }}</code>
            </div>
            <input
              id="block-size"
              v-model.number="blockSize"
              class="setting-range"
              type="range"
              min="0.55"
              max="1"
              step="0.05"
              @change="changeBlockSize"
            >
          </section>

          <section class="field-group">
            <span class="micro-label">Animation speed</span>
            <div class="size-options" role="group" aria-label="Animation speed">
              <button
                v-for="speed in ANIMATION_SPEEDS"
                :key="speed"
                type="button"
                :class="{ 'is-active': animationSpeed === speed }"
                :aria-pressed="animationSpeed === speed"
                @click="setAnimationSpeed(speed)"
              >
                {{ speed }}
              </button>
            </div>
          </section>

          <section class="field-group">
            <span class="micro-label">Maze size</span>
            <div class="size-options" role="group" aria-label="Maze size">
              <button
                v-for="size in MAZE_SIZES"
                :key="size"
                type="button"
                :class="{ 'is-active': mazeSize === size }"
                :aria-pressed="mazeSize === size"
                @click="setMazeSize(size)"
              >
                {{ size }}
              </button>
            </div>
          </section>
        </div>
      </dialog>
    </div>

    <footer class="footnote">
      <span>© 2026 Wujue</span>
      <span class="footnote__dot" />
      <span>v{{ appVersion }}</span>
    </footer>
  </main>
</template>

<style scoped>
@property --theme-primary {
  syntax: "<color>";
  inherits: true;
  initial-value: #42b883;
}

@property --theme-secondary {
  syntax: "<color>";
  inherits: true;
  initial-value: #35495e;
}

@property --theme-on-primary {
  syntax: "<color>";
  inherits: true;
  initial-value: #092d20;
}

:global(*) {
  box-sizing: border-box;
}

:global(html) {
  background: #091017;
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

:global(body) {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow-x: hidden;
}

:global(button),
:global(select) {
  font: inherit;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  min-height: 100svh;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(rgba(255, 255, 255, 0.024) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.024) 1px, transparent 1px),
    radial-gradient(
      circle at 50% 48%,
      color-mix(in srgb, var(--theme-primary) 18%, #10171a) 0,
      color-mix(in srgb, var(--theme-primary) 7%, #0b1315) 42%,
      #080e10 78%
    );
  background-size: 44px 44px, 44px 44px, auto;
  transition:
    --theme-primary 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    --theme-secondary 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    --theme-on-primary 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.hero::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  content: "";
  background: radial-gradient(circle at center, transparent 30%, rgba(5, 10, 15, 0.32));
}

.mask-switcher {
  position: fixed;
  top: 50%;
  left: clamp(20px, 3.5vw, 56px);
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform: translateY(-50%);
}

.mask-switcher button {
  display: grid;
  width: 108px;
  gap: 6px;
  padding: 5px 5px 7px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #849495;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(30, 32, 36, 0.62);
  box-shadow: 0 16px 30px -16px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(18px);
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, transform 150ms ease;
}

.mask-switcher button:hover {
  color: #e2e2e8;
  border-color: rgba(255, 255, 255, 0.16);
  transform: translateX(2px);
}

.mask-switcher button.is-active {
  color: var(--theme-primary);
  border-color: color-mix(in srgb, var(--theme-primary) 62%, transparent);
  box-shadow: 0 0 22px color-mix(in srgb, var(--theme-primary) 18%, transparent);
}

.mask-switcher__preview {
  display: grid;
  width: 96px;
  height: 58px;
  overflow: hidden;
  border-radius: 3px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    rgba(5, 9, 12, 0.82);
  background-size: 12px 12px;
  place-items: center;
}

.mask-switcher__preview img {
  display: block;
  width: 76%;
  height: 76%;
  object-fit: contain;
}

.topbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px clamp(24px, 4.4vw, 72px);
  pointer-events: none;
}

.site-links {
  display: flex;
  align-items: center;
  gap: 5px;
  pointer-events: auto;
}

.site-links a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: rgba(219, 233, 227, 0.64);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.site-links a + a {
  position: relative;
  margin-left: 8px;
}

.site-links a + a::before {
  position: absolute;
  top: 50%;
  left: -10px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(219, 233, 227, 0.3);
  content: "";
  transform: translateY(-50%);
}

.site-links a:hover {
  color: var(--theme-primary);
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(30, 32, 36, 0.52);
}

.site-links img,
.site-links svg {
  display: block;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  object-fit: contain;
}

.site-links a:first-child img {
  width: 28px;
  height: 28px;
  padding: 2px;
  flex-basis: 28px;
  border-radius: 3px;
  background: #fff;
}

.visual {
  position: relative;
  min-width: 0;
  min-height: 100svh;
  grid-column: 1;
  grid-row: 1;
}

.stage {
  position: absolute;
  inset: 0;
}

:deep(.maze-canvas) {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  touch-action: none;
}

.fallback-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(70%, 620px);
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 28px 50px rgba(20, 87, 61, 0.24));
}

.loader {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  gap: 7px;
  transform: translate(-50%, -50%);
}

.loader span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--theme-primary);
  animation: loading 0.9s ease-in-out infinite alternate;
}

.loader span:nth-child(2) {
  animation-delay: 0.15s;
}

.loader span:nth-child(3) {
  animation-delay: 0.3s;
}

.error-message {
  position: absolute;
  right: 24px;
  bottom: 88px;
  max-width: 360px;
  color: #f2a3a3;
  font-size: 0.75rem;
}

.route-hint {
  position: fixed;
  top: 76px;
  left: 50%;
  z-index: 10;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(238, 246, 243, 0.74);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(30, 32, 36, 0.72);
  box-shadow: 0 16px 30px -16px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);
}

.dialog-layer {
  position: fixed;
  z-index: 30;
  inset: 0;
  display: grid;
  padding: 24px;
  background: rgba(5, 10, 15, 0.58);
  backdrop-filter: blur(7px);
  place-items: center;
}

.settings-dialog {
  position: relative;
  display: flex;
  width: min(340px, calc(100vw - 32px));
  max-height: calc(100svh - 48px);
  margin: 0;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  outline: 0;
  color: #e2e2e8;
  background: rgba(30, 32, 36, 0.88);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(24px);
  overflow: auto;
  animation: dialog-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.settings-panel__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.settings-panel__header h2 {
  margin: 3px 0 0;
  color: var(--theme-primary);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.micro-label {
  color: #b9cacb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  opacity: 0.55;
  text-transform: uppercase;
}

.settings-panel__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.collapse-btn {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  color: #b9cacb;
  background: transparent;
  cursor: pointer;
  place-items: center;
  transition: color 150ms ease, background-color 150ms ease;
}

.collapse-btn:hover {
  color: var(--theme-primary);
  background: rgba(255, 255, 255, 0.05);
}

.collapse-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 180ms ease;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-group select {
  width: 100%;
  height: 38px;
  padding: 0 32px 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: 0;
  appearance: none;
  color: #e2e2e8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  background-color: #282a2e;
  background-image:
    linear-gradient(45deg, transparent 50%, #849495 50%),
    linear-gradient(135deg, #849495 50%, transparent 50%);
  background-position:
    calc(100% - 22px) 16px,
    calc(100% - 17px) 16px;
  background-repeat: no-repeat;
  background-size: 5px 5px, 5px 5px;
  cursor: pointer;
}

.field-group select:focus {
  border-color: color-mix(in srgb, var(--theme-primary) 52%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 10%, transparent);
}

.range-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.range-heading code {
  color: var(--theme-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
}

.setting-range {
  width: 100%;
  height: 28px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.setting-range::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.setting-range::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -6px;
  appearance: none;
  border: 0;
  border-radius: 3px;
  background: var(--theme-primary);
  box-shadow: 0 0 6px color-mix(in srgb, var(--theme-primary) 50%, transparent);
}

.setting-range::-moz-range-track {
  height: 2px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.setting-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 3px;
  background: var(--theme-primary);
  box-shadow: 0 0 6px color-mix(in srgb, var(--theme-primary) 50%, transparent);
}

.size-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.size-options button {
  height: 32px;
  border: 0;
  border-radius: 3px;
  color: #849495;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: transparent;
  cursor: pointer;
}

.size-options button:hover {
  color: #e2e2e8;
  background: rgba(255, 255, 255, 0.05);
}

.size-options button.is-active {
  color: var(--theme-on-primary);
  background: var(--theme-primary);
}

.bar-btn:disabled {
  cursor: default;
  opacity: 0.35;
}

.playback-dock {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(30, 32, 36, 0.62);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(24px);
  transform: translateX(-50%);
}

.playback-cluster {
  display: flex;
  align-items: center;
  width: auto;
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  color: #b9cacb;
  background: transparent;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease, transform 150ms ease;
}

.bar-btn:hover:not(:disabled) {
  color: #e2e2e8;
  background: rgba(255, 255, 255, 0.05);
}

.bar-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.bar-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.bar-btn svg.bar-btn__icon--large {
  width: 23px;
  height: 23px;
}

.bar-btn svg.bar-btn__icon--route {
  width: 25px;
  height: 25px;
}

.bar-btn .bar-btn__stroke {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.bar-btn--primary {
  color: var(--theme-on-primary);
  background: var(--theme-primary);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--theme-primary) 22%, transparent);
}

.bar-btn--primary:hover:not(:disabled) {
  color: var(--theme-on-primary);
  background: var(--theme-primary);
  filter: brightness(1.08);
}

.bar-btn--toggle.is-active {
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 16%, transparent);
}

.bar-btn--toggle.is-active:hover:not(:disabled) {
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 24%, transparent);
}

.playback-progress {
  width: calc(100% - 4px);
  height: 3px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-primary) 16%, transparent);
}

.playback-progress span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--theme-primary);
  box-shadow: 0 0 8px color-mix(in srgb, var(--theme-primary) 50%, transparent);
  transform-origin: left center;
  transition: transform 100ms linear;
}

.footnote {
  position: absolute;
  z-index: 5;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  text-align: right;
  color: rgba(183, 202, 195, 0.38);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
}

.footnote__dot {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: currentColor;
}

@keyframes loading {
  to {
    opacity: 0.25;
    transform: translateY(7px);
  }
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@media (max-width: 860px) {
  .hero {
    grid-template-rows: 1fr;
    min-height: 100svh;
  }

  .hero::after {
    background: linear-gradient(180deg, rgba(8, 14, 20, 0.6), transparent 44%);
  }

  .topbar {
    padding: 14px 20px;
  }

  .visual {
    grid-column: 1;
    grid-row: 1;
    min-height: 100svh;
  }

  .stage {
    inset: 0;
  }

  .mask-switcher {
    top: 76px;
    left: 12px;
    gap: 7px;
    transform: none;
  }

  .mask-switcher button {
    width: 78px;
    gap: 4px;
    padding: 4px 4px 6px;
    font-size: 0.52rem;
  }

  .mask-switcher__preview {
    width: 68px;
    height: 42px;
  }

  .visual-status {
    display: none;
  }

  .playback-dock {
    position: fixed;
    bottom: 16px;
    left: 50%;
    width: fit-content;
    margin: 0;
    transform: translateX(-50%);
  }

  .route-hint {
    top: 72px;
    max-width: calc(100vw - 32px);
    white-space: nowrap;
  }

  .playback-progress {
    width: calc(100% - 4px);
    height: 3px;
    margin-top: 4px;
  }

  .footnote {
    display: none;
  }
}

@media (max-width: 520px) {
  .topbar {
    padding-inline: 12px;
  }

  .site-links {
    gap: 0;
  }

  .site-links a {
    gap: 5px;
    min-height: 36px;
    padding: 5px 6px;
    font-size: 0.6rem;
    letter-spacing: 0.035em;
  }

  .site-links a + a {
    margin-left: 6px;
  }

  .site-links a + a::before {
    left: -7px;
    width: 4px;
    height: 4px;
  }

  .site-links img,
  .site-links svg {
    width: 18px;
    height: 18px;
    flex-basis: 18px;
  }

  .site-links a:first-child img {
    width: 22px;
    height: 22px;
    flex-basis: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .loader span,
  .settings-dialog,
  .bar-btn {
    animation: none;
    transition: none;
  }
}
</style>
