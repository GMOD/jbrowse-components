import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'

const TestModel = types.compose(
  'TestModel',
  RenderLifecycleMixin(),
  types.model({}),
)

interface FakeRenderingBackend {
  uploads: number[]
  renders: number
}

test('attachRenderingBackend spawns one upload + render autorun and marks drawn', () => {
  const model = TestModel.create()
  const data = observable.map<number, string>(undefined, { deep: false })
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  expect(model.canvasDrawn).toBe(false)

  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: b => {
      b.uploads.push(-1)
      for (const k of data.keys()) {
        b.uploads.push(k)
      }
      return true
    },
    render: b => {
      if (data.size === 0) {
        return false
      }
      b.renders += 1
      return true
    },
  }))

  // First fire: empty data → upload runs (pushes -1), render returns false,
  // canvasDrawn still false.
  expect(backend.uploads).toEqual([-1])
  expect(backend.renders).toBe(0)
  expect(model.canvasDrawn).toBe(false)

  runInAction(() => {
    data.set(0, 'a')
  })

  // After entry added: upload re-fires (pushes -1, 0), render re-fires.
  expect(backend.uploads).toEqual([-1, -1, 0])
  expect(backend.renders).toBe(1)
  expect(model.canvasDrawn).toBe(true)
})

test('an upload that changed nothing does not force a redraw', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }
  const tick = observable.box(0)

  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: () => tick.get() % 2 === 0,
    render: b => {
      b.renders += 1
      return true
    },
  }))
  expect(backend.renders).toBe(1)

  runInAction(() => {
    tick.set(1)
  })
  expect(backend.renders).toBe(1)

  runInAction(() => {
    tick.set(2)
  })
  expect(backend.renders).toBe(2)
})

test('renderNow bumps renderTick so render autorun re-fires', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: () => true,
    render: b => {
      b.renders += 1
      return true
    },
  }))

  const before = backend.renders

  model.renderNow()

  expect(backend.renders).toBe(before + 1)
})

test('stopRenderingBackend clears backend — autoruns idle', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }
  const data = observable.map<number, string>(undefined, { deep: false })

  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: b => {
      for (const k of data.keys()) {
        b.uploads.push(k)
      }
      return true
    },
    render: b => {
      b.renders += 1
      return true
    },
  }))

  const uploadsAtStop = backend.uploads.length
  const rendersAtStop = backend.renders

  expect(model.canvasDrawn).toBe(true)
  model.stopRenderingBackend()

  // canvasDrawn resets so the loading overlay re-appears during GPU re-init.
  expect(model.canvasDrawn).toBe(false)

  // Mutate data — autoruns should early-return because backend is undefined.
  runInAction(() => {
    data.set(0, 'a')
  })

  expect(backend.uploads.length).toBe(uploadsAtStop)
  expect(backend.renders).toBe(rendersAtStop)
})

test('re-calling attachRenderingBackend swaps backend without re-installing autoruns', () => {
  const model = TestModel.create()
  const backend1: FakeRenderingBackend = { uploads: [], renders: 0 }
  const backend2: FakeRenderingBackend = { uploads: [], renders: 0 }
  const data = observable.map<number, string>(undefined, { deep: false })

  let setups = 0
  const setup = () => {
    setups++
    return {
      upload: (b: FakeRenderingBackend) => {
        for (const k of data.keys()) {
          b.uploads.push(k)
        }
        return true
      },
      render: (b: FakeRenderingBackend) => {
        b.renders += 1
        return true
      },
    }
  }

  model.attachRenderingBackend<FakeRenderingBackend>(backend1, setup)
  runInAction(() => {
    data.set(0, 'a')
  })

  expect(backend1.uploads).toEqual([0])
  expect(backend1.renders).toBeGreaterThan(0)
  expect(setups).toBe(1)

  // Context-loss recovery: install new backend.
  model.attachRenderingBackend<FakeRenderingBackend>(backend2, setup)

  // Autoruns re-fire against backend2 because currentRenderingBackend changed.
  expect(backend2.uploads).toEqual([0])
  expect(backend2.renders).toBeGreaterThan(0)
  // …and the setup thunk did not run again, so whatever the callbacks close
  // over — an upload sync's memo of what it last sent — survived the recovery
  // rather than being rebuilt and dropped.
  expect(setups).toBe(1)
})

test('a throw in the render callback sets renderError instead of escaping (no infinite loading)', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  expect(model.renderError).toBeUndefined()

  const err = new Error('Unknown wiggle rendering type: ')
  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: () => true,
    render: () => {
      throw err
    },
  }))

  // The throw is caught and routed to renderError (which drives the
  // 'renderError' display phase), and canvasDrawn never flips.
  expect(model.renderError).toBe(err)
  expect(model.canvasDrawn).toBe(false)
})

test('a throw in the upload callback sets renderError instead of escaping (no infinite loading)', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  expect(model.renderError).toBeUndefined()

  const err = new Error('malformed upload data')
  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: () => {
      throw err
    },
    // upload never populated GPU buffers, so there is nothing to draw
    render: () => false,
  }))

  // The upload throw is caught and routed to renderError (driving the
  // 'renderError' display phase) instead of escaping as an uncaught reaction
  // error; canvasDrawn never flips.
  expect(model.renderError).toBe(err)
  expect(model.canvasDrawn).toBe(false)
})

test('canvasDrawn resets to false when directly cleared (clearAllRpcData contract)', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: () => true,
    render: b => {
      b.renders += 1
      return true
    },
  }))

  expect(model.canvasDrawn).toBe(true)

  model.resetCanvasDrawn()

  expect(model.canvasDrawn).toBe(false)
})

// `painted`, the answer every reader outside the display should take. A display
// that renders a deliberate static placeholder instead of a canvas (LD with the
// triangle off, sequence past base resolution) never calls `canvasRef`, so no
// backend is built and `canvasDrawn` can never flip. Read off the raw flag, its
// `data-display-drawn` stayed `"false"` for the display's whole life and every
// `waitForDisplaysDone` on the page timed out silently.
const NoCanvasModel = types.compose(
  'NoCanvasModel',
  RenderLifecycleMixin(),
  types.model({}).views(() => ({
    get rendersCanvas() {
      return false
    },
  })),
)

test('painted reports true for a display that renders no canvas', () => {
  const model = NoCanvasModel.create()

  expect(model.canvasDrawn).toBe(false)
  expect(model.painted).toBe(true)
})

// The third term, and the same argument once more. A display that WOULD paint a
// canvas but whose fetch failed before first paint keeps its canvas mounted (the
// error bar is an overlay, not a subtree replacement), so `canvasDrawn` never
// flips and `data-display-drawn` published `"false"` for the rest of the
// session — which is what `PENDING_DISPLAYS` selects on, so one broken track URL
// made every `waitForDisplaysDone` on the page burn its full timeout, silently.
// Both LGV fetch families fill this hook with `!!error`.
const InertModel = types.compose(
  'InertModel',
  RenderLifecycleMixin(),
  types.model({ inert: false }).views(self => ({
    get paintInert() {
      return self.inert
    },
  })),
)

test('painted reports true for a canvas display that will not paint', () => {
  const model = InertModel.create({})

  expect(model.rendersCanvas).toBe(true)
  expect(model.canvasDrawn).toBe(false)
  expect(model.painted).toBe(false)

  const inert = InertModel.create({ inert: true })
  expect(inert.rendersCanvas).toBe(true)
  expect(inert.canvasDrawn).toBe(false)
  expect(inert.painted).toBe(true)
})

test('painted tracks canvasDrawn for a display that does render one', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  expect(model.rendersCanvas).toBe(true)
  expect(model.painted).toBe(false)

  model.attachRenderingBackend<FakeRenderingBackend>(backend, () => ({
    upload: () => true,
    render: () => true,
  }))

  expect(model.painted).toBe(true)

  // the teardown path resets it, so a display whose canvas unmounts goes back
  // to reporting pending rather than claiming a paint it no longer has
  model.stopRenderingBackend()
  expect(model.painted).toBe(false)
})
