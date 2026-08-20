import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { installGlobalLifecycle } from './installGlobalLifecycle.ts'

const TestModel = types
  .compose('TestModel', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({}))

interface FakeRenderingBackend {
  uploadData(data: string): void
  uploadColorRamp(ramp: string): void
}

function makeFakeRenderingBackend() {
  const calls: string[] = []
  const backend: FakeRenderingBackend = {
    uploadData(data) {
      calls.push(`data:${data}`)
    },
    uploadColorRamp(ramp) {
      calls.push(`ramp:${ramp}`)
    },
  }
  return { backend, calls }
}

beforeEach(() => {
  console.error = jest.fn()
})

// The failure this exists for: a display's slots share one upload autorun, so
// without the per-slot diff a palette flip re-pushed the whole contact matrix
// and a new fetch rebuilt the ramp texture.
test('a slot whose input is unchanged does not re-upload when a sibling slot changes', () => {
  const model = TestModel.create()
  const { backend, calls } = makeFakeRenderingBackend()
  const matrix = observable.box('m1')
  const palette = observable.box('p1')

  installGlobalLifecycle<FakeRenderingBackend>(model, backend, {
    upload: (b, slot) => {
      slot('data', matrix.get(), (bb, v) => {
        bb.uploadData(v)
      })
      slot('colorRamp', palette.get(), (bb, v) => {
        bb.uploadColorRamp(v)
      })
    },
    render: () => true,
  })

  expect(calls).toEqual(['data:m1', 'ramp:p1'])

  runInAction(() => {
    palette.set('p2')
  })
  expect(calls).toEqual(['data:m1', 'ramp:p1', 'ramp:p2'])

  runInAction(() => {
    matrix.set('m2')
  })
  expect(calls).toEqual(['data:m1', 'ramp:p1', 'ramp:p2', 'data:m2'])
})

test('a display whose uploads share one input can ignore the slot argument', () => {
  const model = TestModel.create()
  const { backend, calls } = makeFakeRenderingBackend()
  const rpcData = observable.box('d1')

  installGlobalLifecycle<FakeRenderingBackend>(model, backend, {
    upload: b => {
      b.uploadData(rpcData.get())
    },
    render: () => true,
  })

  expect(calls).toEqual(['data:d1'])
  runInAction(() => {
    rpcData.set('d2')
  })
  expect(calls).toEqual(['data:d1', 'data:d2'])
})

test('a context-loss recovery re-uploads every slot into the new backend', () => {
  const model = TestModel.create()
  const a = makeFakeRenderingBackend()
  const b = makeFakeRenderingBackend()
  const matrix = observable.box('m1')
  const spec = {
    upload: (bb: FakeRenderingBackend, slot: any) => {
      slot('data', matrix.get(), (bbb: FakeRenderingBackend, v: string) => {
        bbb.uploadData(v)
      })
    },
    render: () => true,
  }

  installGlobalLifecycle<FakeRenderingBackend>(model, a.backend, spec)
  expect(a.calls).toEqual(['data:m1'])

  installGlobalLifecycle<FakeRenderingBackend>(model, b.backend, spec)

  // Only the GPU buffers were lost, and the slot memo notices the backend it
  // has not seen rather than skipping on an unchanged input.
  expect(b.calls).toEqual(['data:m1'])
})
