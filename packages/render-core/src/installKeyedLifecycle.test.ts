import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { installKeyedLifecycle } from './installKeyedLifecycle.ts'

const TestModel = types
  .compose('TestModel', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({}))

function makeFakeRenderingBackend() {
  const uploads: [number, string][] = []
  const deletes: number[] = []
  const backend = {
    uploadGeometry(key: number, data: string) {
      uploads.push([key, data])
    },
    deleteGeometry(key: number) {
      deletes.push(key)
    },
  }
  return { backend, uploads, deletes }
}

beforeEach(() => {
  console.error = jest.fn()
})

test('only the display whose geometry changed re-uploads', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const entries = observable.map<number, string>(undefined, { deep: false })

  installKeyedLifecycle(model, backend, {
    entries: () => entries,
    render: () => true,
  })

  runInAction(() => {
    entries.set(1, 'a')
    entries.set(2, 'b')
  })
  expect(uploads).toEqual([
    [1, 'a'],
    [2, 'b'],
  ])

  // A sibling committing new geometry re-fires the one shared upload autorun
  // for every display on the canvas; the diff is what keeps the others' bytes
  // off the bus.
  runInAction(() => {
    entries.set(2, 'b2')
  })
  expect(uploads).toEqual([
    [1, 'a'],
    [2, 'b'],
    [2, 'b2'],
  ])
})

test('a departed key is deleted individually, not pruned by active set', () => {
  const model = TestModel.create()
  const { backend, deletes } = makeFakeRenderingBackend()
  const entries = observable.map<number, string>(undefined, { deep: false })

  installKeyedLifecycle(model, backend, {
    entries: () => entries,
    render: () => true,
  })

  runInAction(() => {
    entries.set(1, 'a')
    entries.set(2, 'b')
  })
  runInAction(() => {
    entries.delete(1)
  })

  expect(deletes).toEqual([1])
})

test('a context-loss recovery re-uploads every key into the new backend', () => {
  const model = TestModel.create()
  const a = makeFakeRenderingBackend()
  const b = makeFakeRenderingBackend()
  const entries = observable.map<number, string>(undefined, { deep: false })

  installKeyedLifecycle(model, a.backend, {
    entries: () => entries,
    render: () => true,
  })
  runInAction(() => {
    entries.set(1, 'a')
  })
  expect(a.uploads).toEqual([[1, 'a']])

  installKeyedLifecycle(model, b.backend, {
    entries: () => entries,
    render: () => true,
  })

  expect(b.uploads).toEqual([[1, 'a']])
})
