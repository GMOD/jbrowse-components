import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'

// fullyDrawn = canvasDrawn && !isLoading is defined in MultiRegionDisplayMixin.
// That mixin can't be instantiated standalone (afterAttach calls getContainingView),
// so we compose the two source mixins here and mirror the one-liner getter.
const TestModel = types
  .compose(
    'TestModel',
    GpuBackendLifecycleSlotMixin(),
    FetchMixin(),
    types.model({}),
  )
  .views(self => ({
    get fullyDrawn() {
      return self.canvasDrawn && !self.isLoading
    },
  }))

function tick() {
  return Promise.resolve()
}

// Silence the temporary FetchMixin timing log and GPU renderer debug output.
beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

describe('fullyDrawn: loading overlay invariant', () => {
  test('false on create — no fetch started, no render yet', () => {
    const m = TestModel.create()
    expect(m.fullyDrawn).toBe(false)
  })

  test('false during active fetch', async () => {
    const m = TestModel.create()
    let resolve!: () => void
    m.runFetch(() => new Promise<void>(r => (resolve = r)))
    expect(m.isLoading).toBe(true)
    expect(m.fullyDrawn).toBe(false)
    resolve()
    await tick()
    await tick()
  })

  test('false when canvas drawn but fetch still in flight', async () => {
    const m = TestModel.create()
    let resolve!: () => void
    m.runFetch(() => new Promise<void>(r => (resolve = r)))
    m.markCanvasDrawn()
    expect(m.canvasDrawn).toBe(true)
    expect(m.isLoading).toBe(true)
    expect(m.fullyDrawn).toBe(false)
    resolve()
    await tick()
    await tick()
  })

  test('true only after canvas drawn AND no active fetch', () => {
    const m = TestModel.create()
    m.installGpuDisplay(
      { renders: 0 },
      {
        upload: () => {},
        render: b => {
          b.renders++
          return true
        },
      },
    )
    expect(m.canvasDrawn).toBe(true)
    expect(m.isLoading).toBe(false)
    expect(m.fullyDrawn).toBe(true)
  })

  test('resets to false after resetCanvasDrawn (simulates clearAllRpcData)', () => {
    const m = TestModel.create()
    m.installGpuDisplay(
      { renders: 0 },
      {
        upload: () => {},
        render: b => {
          b.renders++
          return true
        },
      },
    )
    expect(m.fullyDrawn).toBe(true)
    m.resetCanvasDrawn()
    expect(m.fullyDrawn).toBe(false)
  })

  test('full lifecycle: create → fetch → render → fullyDrawn', async () => {
    const m = TestModel.create()

    // Phase 1: track just opened, 600ms autorun delay not yet elapsed
    expect(m.fullyDrawn).toBe(false)

    // Phase 2: fetch starts
    let resolve!: () => void
    m.runFetch(() => new Promise<void>(r => (resolve = r)))
    expect(m.fullyDrawn).toBe(false)

    // Phase 3: fetch completes, GPU not yet rendered
    resolve()
    await tick()
    await tick()
    expect(m.isLoading).toBe(false)
    expect(m.canvasDrawn).toBe(false)
    expect(m.fullyDrawn).toBe(false)

    // Phase 4: GPU backend installs and renders first frame
    m.installGpuDisplay(
      { renders: 0 },
      {
        upload: () => {},
        render: b => {
          b.renders++
          return true
        },
      },
    )
    expect(m.fullyDrawn).toBe(true)
  })
})
