import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { MockHal } from './hal/mockHal.ts'
import { installUpload } from './installUpload.ts'
import { GpuPerRegionRenderingBackend } from './perRegionRenderingBackend.ts'

import type { FrameDimensions } from './perRegionRenderingBackend.ts'
import type { RenderBlock } from './renderBlock.ts'

// The whole point of the release is that it reaches the HAL, so every
// assertion here reads `MockHal`'s call log rather than the model's flag: a
// version that sets `offScreen` and never calls through passes the flag check
// and fails these.

interface Data {
  value: number
}

const STATE: FrameDimensions = { canvasWidth: 800, canvasHeight: 400 }

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 800,
  reversed: false,
}

class TestBackend extends GpuPerRegionRenderingBackend<Data, FrameDimensions> {
  protected regionPasses = []
  protected drawRegion() {}
}

const TestModel = types.compose(
  'TestModel',
  RenderLifecycleMixin(),
  types.model({}),
)

function setup() {
  const hal = new MockHal([])
  const backend = new TestBackend(hal)
  const model = TestModel.create()
  const cells = observable.map<number, Data>(undefined, { deep: false })
  installUpload(model, backend, {
    cells: () => cells,
    render: (b, encoded) => b.renderBlocks([BLOCK], encoded, STATE),
  })
  runInAction(() => {
    cells.set(0, { value: 1 })
  })
  return { hal, model, cells }
}

function methods(hal: MockHal) {
  return hal.calls.map(c => c.method)
}

test('a drawing display never releases its targets', () => {
  const { hal, model, cells } = setup()
  expect(model.canvasDrawn).toBe(true)

  runInAction(() => {
    cells.set(0, { value: 2 })
  })
  runInAction(() => {
    model.renderNow()
  })

  expect(hal.callsOf('resize').length).toBeGreaterThan(1)
  expect(hal.callsOf('releaseRenderTargets')).toHaveLength(0)
})

test('going off screen releases the targets and stops sizing the canvas', () => {
  const { hal, model, cells } = setup()
  hal.calls = []

  runInAction(() => {
    model.setOffScreen(true)
  })
  expect(methods(hal)).toEqual(['releaseRenderTargets'])

  // Every later tick has to re-release rather than resize: `renderBlocks`
  // reallocates the target on its opening `resize`, so a single release that
  // the next pan undoes saves nothing.
  runInAction(() => {
    cells.set(0, { value: 3 })
  })
  runInAction(() => {
    model.renderNow()
  })
  expect(hal.callsOf('resize')).toHaveLength(0)
  expect(hal.callsOf('releaseRenderTargets').length).toBeGreaterThan(1)
})

test('coming back on screen resizes again and draws', () => {
  const { hal, model } = setup()
  runInAction(() => {
    model.setOffScreen(true)
  })
  hal.calls = []

  runInAction(() => {
    model.setOffScreen(false)
  })

  expect(hal.callsOf('resize').length).toBeGreaterThan(0)
  expect(hal.callsOf('releaseRenderTargets')).toHaveLength(0)
  expect(model.paintCount).toBeGreaterThan(1)
})

test('a display that has never painted paints once off screen, then releases', () => {
  const hal = new MockHal([])
  const backend = new TestBackend(hal)
  const model = TestModel.create()
  const cells = observable.map<number, Data>(undefined, { deep: false })
  installUpload(model, backend, {
    cells: () => cells,
    render: (b, encoded) => b.renderBlocks([BLOCK], encoded, STATE),
  })
  runInAction(() => {
    model.setOffScreen(true)
  })
  hal.calls = []

  runInAction(() => {
    cells.set(0, { value: 1 })
  })

  // `data-display-drawn` is what every capture waits on, so a track loading
  // below the fold still has to reach first paint.
  expect(model.canvasDrawn).toBe(true)
  expect(hal.callsOf('resize').length).toBeGreaterThan(0)
  expect(hal.callsOf('releaseRenderTargets').length).toBeGreaterThan(0)
  expect(methods(hal).at(-1)).toBe('releaseRenderTargets')
})
