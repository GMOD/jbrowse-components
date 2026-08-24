import { types } from '@jbrowse/mobx-state-tree'
import { computed, observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { installUpload } from './installUpload.ts'

const TestModel = types
  .compose('TestModel', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({}))

interface FakeRegionData {
  value: number
}

// Why this file exists rather than another render count: the count in
// installUpload.test.ts says a region arrival paints once, and a
// helper that painted once *before* uploading would satisfy it while showing
// the user an empty frame. What has to hold is the order.
//
// It used to fail, and not by an accident of scheduling. An `autorun` created
// inside a running reaction is scheduled, not run inline, so the per-key autorun
// that owned the upload could not run in the pass that spawned it: a render
// callback observing the map painted the pre-upload state first and the real
// state on the `renderTick` bump. Uploading inside the upload autorun's own run
// is what closes that window — see ADR-078.
test('an arrival uploads before anything paints, whether or not render reads the map', () => {
  for (const renderReadsTheMap of [false, true]) {
    const log: string[] = []
    const model = TestModel.create()
    const data = observable.map<number, FakeRegionData>(undefined, {
      deep: false,
    })
    const backend = {
      upload(key: number) {
        log.push(`upload:${key}`)
      },
      release() {},
    }

    installUpload(model, backend, {
      cells: () => data,
      encode: ({ value }: FakeRegionData) => ({ value }),
      render: (_b, encoded) => {
        log.push(`render:${encoded.size}`)
        return renderReadsTheMap ? data.size > 0 : true
      },
    })

    log.length = 0
    runInAction(() => {
      data.set(0, { value: 10 })
    })
    runInAction(() => {
      data.set(1, { value: 20 })
    })

    // Every paint sees a backend holding every region the map holds.
    expect(log).toEqual(['upload:0', 'render:1', 'upload:1', 'render:2'])
  }
})

// The same question for the indirect shape, because ARCHITECTURAL_LIMITS named
// it as the one that could not be fixed by deleting a direct read: a display
// whose render callback reaches the data through a computed chain
// (`renderState` → lanes → the map) rather than reading it. Both reactions are
// woken by the same write, and the upload still lands first.
test('a render callback reaching the map through a computed chain also paints after the upload', () => {
  const log: string[] = []
  const model = TestModel.create()
  const data = observable.map<number, FakeRegionData>(undefined, {
    deep: false,
  })
  const backend = {
    upload(key: number) {
      log.push(`upload:${key}`)
    },
    release() {},
  }
  const lanes = computed(() => [...data.keys()].map(k => k * 2))
  const renderState = computed(() => ({ laneCount: lanes.get().length }))

  installUpload(model, backend, {
    cells: () => data,
    encode: ({ value }: FakeRegionData) => ({ value }),
    render: (_b, encoded) => {
      log.push(`render:${renderState.get().laneCount}/${encoded.size}`)
      return true
    },
  })

  log.length = 0
  runInAction(() => {
    data.set(0, { value: 10 })
  })
  runInAction(() => {
    data.set(1, { value: 20 })
  })

  // The lane count and the backend's region count agree on every paint.
  expect(log).toEqual(['upload:0', 'render:1/1', 'upload:1', 'render:2/2'])
})
