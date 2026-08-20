import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { installPerRegionLifecycle } from './installPerRegionLifecycle.ts'

const TestModel = types
  .compose('TestModel', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({}))

// Why this file exists rather than another render count: the count in
// installPerRegionLifecycle.test.ts says a region arrival paints once, and a
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
    const data = observable.map<number, number>(undefined, { deep: false })
    const backend = {
      uploadRegion(key: number) {
        log.push(`upload:${key}`)
      },
      pruneRegions() {},
    }

    installPerRegionLifecycle(model, data, backend, {
      encode: (value: number) => ({ value }),
      render: (_b, encoded) => {
        log.push(`render:${encoded.size}`)
        return renderReadsTheMap ? data.size > 0 : true
      },
    })

    log.length = 0
    runInAction(() => {
      data.set(0, 10)
    })
    runInAction(() => {
      data.set(1, 20)
    })

    // Every paint sees a backend holding every region the map holds.
    expect(log).toEqual(['upload:0', 'render:1', 'upload:1', 'render:2'])
  }
})
