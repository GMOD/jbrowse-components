import { autorun, observable, runInAction } from 'mobx'

import { fetchInputsCurrent, makeFetchInputs } from './fetchInputs.ts'

import type { FetchInputsHost } from './fetchInputs.ts'

function hostOver(rpcProps: () => unknown, zoom: () => object) {
  return {
    rpcProps,
    adapterConfig: { type: 'BigWigAdapter' },
    zoomFetchArgs: zoom,
    zoomFetchKey: '',
  } as unknown as FetchInputsHost
}

describe('fetchInputs', () => {
  it('holds one value identity across a recomputation onto equal content', () => {
    const box = observable.box(1)
    const { inputs } = makeFetchInputs(
      hostOver(
        () => ({ useBicolor: true }),
        () => ({ bpPerPx: box.get() }),
      ),
    )
    const dispose = autorun(() => {
      inputs.get()
    })
    const first = inputs.get()
    runInAction(() => {
      box.set(1)
    })
    expect(inputs.get()).toBe(first)
    runInAction(() => {
      box.set(2)
    })
    expect(inputs.get()).not.toBe(first)
    expect(fetchInputsCurrent(first, inputs.get())).toBe(false)
    dispose()
  })

  // The two states the serialized key could not tell apart. Both are the
  // silently-dead cache axis ARCHITECTURE.md warns about: nothing errors, the
  // display simply never refetches.
  it('separates a field present-but-undefined from one the payload omits', () => {
    // The shape a conditional spread produces — `...(solo ? { ids } : {})`
    // against `ids: solo ? toJS(list) : undefined`. Two states, one
    // serialization, so the serialized key refetched neither.
    const solo = observable.box(true)
    const { inputs } = makeFetchInputs(
      hostOver(
        () =>
          solo.get()
            ? { colorByCDS: true, soloFeatureIds: undefined }
            : { colorByCDS: true },
        () => ({}),
      ),
    )
    const dispose = autorun(() => {
      inputs.get()
    })
    const before = inputs.get()
    runInAction(() => {
      solo.set(false)
    })
    expect(JSON.stringify(inputs.get())).toBe(JSON.stringify(before))
    expect(fetchInputsCurrent(before, inputs.get())).toBe(false)
    dispose()
  })

  it('separates two states of a class that serializes to the same thing', () => {
    class FilterChain {
      constructor(private readonly exprs: string[]) {}
      toJSON() {
        return {}
      }
    }
    const exprs = observable.box(['a'])
    const { inputs } = makeFetchInputs(
      hostOver(
        () => ({ filters: new FilterChain(exprs.get()) }),
        () => ({}),
      ),
    )
    const dispose = autorun(() => {
      inputs.get()
    })
    const before = inputs.get()
    runInAction(() => {
      exprs.set(['b'])
    })
    expect(JSON.stringify(inputs.get())).toBe(JSON.stringify(before))
    expect(fetchInputsCurrent(before, inputs.get())).toBe(false)
    dispose()
  })

  it('falls back to the zoomFetchKey string for a display that declares no args', () => {
    const key = observable.box('16')
    const host = {
      adapterConfig: { type: 'BigWigAdapter' },
      get zoomFetchKey() {
        return key.get()
      },
    } as unknown as FetchInputsHost
    const { inputs } = makeFetchInputs(host)
    const dispose = autorun(() => {
      inputs.get()
    })
    const before = inputs.get()
    expect(before.zoom).toBe('16')
    runInAction(() => {
      key.set('8')
    })
    expect(fetchInputsCurrent(before, inputs.get())).toBe(false)
    dispose()
  })
})
