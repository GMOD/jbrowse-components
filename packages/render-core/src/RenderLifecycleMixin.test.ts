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

  model.attachRenderingBackend<FakeRenderingBackend>(backend, {
    upload: b => {
      b.uploads.push(-1)
      for (const k of data.keys()) {
        b.uploads.push(k)
      }
    },
    render: b => {
      if (data.size === 0) {
        return false
      }
      b.renders += 1
      return true
    },
  })

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

test('renderNow bumps renderTick so render autorun re-fires', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  model.attachRenderingBackend<FakeRenderingBackend>(backend, {
    upload: () => {},
    render: b => {
      b.renders += 1
      return true
    },
  })

  const before = backend.renders

  model.renderNow()

  expect(backend.renders).toBe(before + 1)
})

test('stopRenderingBackend clears backend — autoruns idle', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }
  const data = observable.map<number, string>(undefined, { deep: false })

  model.attachRenderingBackend<FakeRenderingBackend>(backend, {
    upload: b => {
      for (const k of data.keys()) {
        b.uploads.push(k)
      }
    },
    render: b => {
      b.renders += 1
      return true
    },
  })

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

  const cbs = {
    upload: (b: FakeRenderingBackend) => {
      for (const k of data.keys()) {
        b.uploads.push(k)
      }
    },
    render: (b: FakeRenderingBackend) => {
      b.renders += 1
      return true
    },
  }

  model.attachRenderingBackend<FakeRenderingBackend>(backend1, cbs)
  runInAction(() => {
    data.set(0, 'a')
  })

  expect(backend1.uploads).toEqual([0])
  expect(backend1.renders).toBeGreaterThan(0)

  // Context-loss recovery: install new backend.
  model.attachRenderingBackend<FakeRenderingBackend>(backend2, cbs)

  // Autoruns re-fire against backend2 because currentRenderingBackend changed.
  expect(backend2.uploads).toEqual([0])
  expect(backend2.renders).toBeGreaterThan(0)
})

test('a throw in the render callback sets renderError instead of escaping (no infinite loading)', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  expect(model.renderError).toBeUndefined()

  const err = new Error('Unknown wiggle rendering type: ')
  model.attachRenderingBackend<FakeRenderingBackend>(backend, {
    upload: () => {},
    render: () => {
      throw err
    },
  })

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
  model.attachRenderingBackend<FakeRenderingBackend>(backend, {
    upload: () => {
      throw err
    },
    // upload never populated GPU buffers, so there is nothing to draw
    render: () => false,
  })

  // The upload throw is caught and routed to renderError (driving the
  // 'renderError' display phase) instead of escaping as an uncaught reaction
  // error; canvasDrawn never flips.
  expect(model.renderError).toBe(err)
  expect(model.canvasDrawn).toBe(false)
})

test('canvasDrawn resets to false when directly cleared (clearAllRpcData contract)', () => {
  const model = TestModel.create()
  const backend: FakeRenderingBackend = { uploads: [], renders: 0 }

  model.attachRenderingBackend<FakeRenderingBackend>(backend, {
    upload: () => {},
    render: b => {
      b.renders += 1
      return true
    },
  })

  expect(model.canvasDrawn).toBe(true)

  model.resetCanvasDrawn()

  expect(model.canvasDrawn).toBe(false)
})
