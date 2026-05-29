import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { GpuLifecycleMixin } from './GpuLifecycleMixin.ts'

const TestModel = types.compose(
  'TestModel',
  GpuLifecycleMixin(),
  types.model({}),
)

interface FakeBackend {
  uploads: number[]
  renders: number
}

test('attachBackend spawns one upload + render autorun and marks drawn', () => {
  const model = TestModel.create()
  const data = observable.map<number, string>(undefined, { deep: false })
  const backend: FakeBackend = { uploads: [], renders: 0 }

  expect(model.canvasDrawn).toBe(false)

  model.attachBackend<FakeBackend>(backend, {
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
  const backend: FakeBackend = { uploads: [], renders: 0 }

  model.attachBackend<FakeBackend>(backend, {
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

test('stopBackend clears backend — autoruns idle', () => {
  const model = TestModel.create()
  const backend: FakeBackend = { uploads: [], renders: 0 }
  const data = observable.map<number, string>(undefined, { deep: false })

  model.attachBackend<FakeBackend>(backend, {
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
  model.stopBackend()

  // canvasDrawn resets so the loading overlay re-appears during GPU re-init.
  expect(model.canvasDrawn).toBe(false)

  // Mutate data — autoruns should early-return because backend is undefined.
  runInAction(() => {
    data.set(0, 'a')
  })

  expect(backend.uploads.length).toBe(uploadsAtStop)
  expect(backend.renders).toBe(rendersAtStop)
})

test('re-calling attachBackend swaps backend without re-installing autoruns', () => {
  const model = TestModel.create()
  const backend1: FakeBackend = { uploads: [], renders: 0 }
  const backend2: FakeBackend = { uploads: [], renders: 0 }
  const data = observable.map<number, string>(undefined, { deep: false })

  const cbs = {
    upload: (b: FakeBackend) => {
      for (const k of data.keys()) {
        b.uploads.push(k)
      }
    },
    render: (b: FakeBackend) => {
      b.renders += 1
      return true
    },
  }

  model.attachBackend<FakeBackend>(backend1, cbs)
  runInAction(() => {
    data.set(0, 'a')
  })

  expect(backend1.uploads).toEqual([0])
  expect(backend1.renders).toBeGreaterThan(0)

  // Context-loss recovery: install new backend.
  model.attachBackend<FakeBackend>(backend2, cbs)

  // Autoruns re-fire against backend2 because currentBackend changed.
  expect(backend2.uploads).toEqual([0])
  expect(backend2.renders).toBeGreaterThan(0)
})

test('canvasDrawn resets to false when directly cleared (clearAllRpcData contract)', () => {
  const model = TestModel.create()
  const backend: FakeBackend = { uploads: [], renders: 0 }

  model.attachBackend<FakeBackend>(backend, {
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
