import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { autorun, observable, runInAction } from 'mobx'

import { makeFetchInputs, makeSettingsFetchInputs } from './fetchInputs.ts'

function settingsOver(rpcProps: () => unknown) {
  return makeSettingsFetchInputs({
    rpcProps,
    adapterConfig: { type: 'BigWigAdapter' },
  })
}

function inputsOver(rpcProps: () => unknown, zoom: () => object) {
  const settings = settingsOver(rpcProps)
  return makeFetchInputs({
    get settingsFetchInputs() {
      return settings.get()
    },
    zoomFetchArgs: zoom,
  })
}

function observed<T>(value: { get: () => T }) {
  return autorun(() => {
    value.get()
  })
}

describe('fetchInputs', () => {
  it('holds one value identity across a recomputation onto equal content', () => {
    const box = observable.box(1)
    const inputs = inputsOver(
      () => ({ useBicolor: true }),
      () => ({ bpPerPx: box.get() }),
    )
    const dispose = observed(inputs)
    const first = inputs.get()
    runInAction(() => {
      box.set(1)
    })
    expect(inputs.get()).toBe(first)
    runInAction(() => {
      box.set(2)
    })
    expect(inputs.get()).not.toBe(first)
    expect(isDataCurrent(first, inputs.get())).toBe(false)
    dispose()
  })

  // `SettingsInvalidate` and the byte gate read the settings axis directly, not
  // through a structural key above it, so its own identity is what keeps a
  // consulted-but-unreturned read from superseding the fetch.
  it('holds the settings identity across a read the payload does not return', () => {
    const consulted = observable.box('x')
    const settings = settingsOver(() => {
      void consulted.get()
      return { useBicolor: true }
    })
    const dispose = observed(settings)
    const first = settings.get()
    runInAction(() => {
      consulted.set('y')
    })
    expect(settings.get()).toBe(first)
    dispose()
  })

  // The two states a serialized key could not tell apart. Both are a silently
  // dead cache axis: nothing errors, the display simply never refetches.
  it('separates a field present-but-undefined from one the payload omits', () => {
    // The shape a conditional spread produces — `...(solo ? { ids } : {})`
    // against `ids: solo ? toJS(list) : undefined`. Two states, one
    // serialization, so the serialized key refetched neither.
    const solo = observable.box(true)
    const settings = settingsOver(() =>
      solo.get()
        ? { colorByCDS: true, soloFeatureIds: undefined }
        : { colorByCDS: true },
    )
    const dispose = observed(settings)
    const before = settings.get()
    runInAction(() => {
      solo.set(false)
    })
    expect(JSON.stringify(settings.get())).toBe(JSON.stringify(before))
    expect(isDataCurrent(before, settings.get())).toBe(false)
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
    const settings = settingsOver(() => ({
      filters: new FilterChain(exprs.get()),
    }))
    const dispose = observed(settings)
    const before = settings.get()
    runInAction(() => {
      exprs.set(['b'])
    })
    expect(JSON.stringify(settings.get())).toBe(JSON.stringify(before))
    expect(isDataCurrent(before, settings.get())).toBe(false)
    dispose()
  })

  // The hazard a value stamp has and a serialized key does not: the stamp
  // outlives the fetch that wrote it, so a live collection reaching it goes on
  // changing inside every stamp and the staleness compare reads the current
  // state against itself.
  it('stamps a live collection by value, so a later mutation does not follow it', () => {
    const live = observable.array(['a'])
    const settings = settingsOver(() => ({ subtreeFilter: live }))
    const dispose = observed(settings)
    const stamped = settings.get()
    runInAction(() => {
      live.push('b')
    })
    expect(isDataCurrent(stamped, settings.get())).toBe(false)
    dispose()
  })

  // The same fact from the other side: nothing reachable from the stamp can be
  // written at all, so a display that hands over a container it then mutates in
  // place fails loudly rather than going stale in silence.
  it('freezes the containers it rebuilds', () => {
    const settings = settingsOver(() => ({ ids: ['a'] }))
    const stamped = settings.get() as { rpcProps: { ids: string[] } }
    expect(() => stamped.rpcProps.ids.push('b')).toThrow()
  })

  it('leaves the zoom tier undefined for a display that declares no args', () => {
    const inputs = makeFetchInputs({ settingsFetchInputs: {} })
    expect(inputs.get().zoom).toBeUndefined()
  })
})
