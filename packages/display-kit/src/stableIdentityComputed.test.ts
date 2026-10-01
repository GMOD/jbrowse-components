import { autorun, observable, runInAction } from 'mobx'

import { stableIdentityComputed } from './stableIdentityComputed.ts'

function rowsOver(regions: Map<number, string[]>) {
  return stableIdentityComputed(() =>
    [...new Set([...regions.values()].flat())].map(name => ({ name })),
  )
}

describe('stableIdentityComputed', () => {
  it('hands back the same value when a recomputation is structurally equal', () => {
    const regions = observable.map<number, string[]>([[0, ['a', 'b']]])
    const rows = rowsOver(regions)
    const dispose = autorun(() => {
      rows.get()
    })
    const first = rows.get()
    runInAction(() => {
      regions.set(1, ['b', 'a'])
    })
    expect(rows.get()).toBe(first)
    dispose()
  })

  it('hands back a new value when the content changes', () => {
    const regions = observable.map<number, string[]>([[0, ['a']]])
    const rows = rowsOver(regions)
    const dispose = autorun(() => {
      rows.get()
    })
    const first = rows.get()
    runInAction(() => {
      regions.set(1, ['c'])
    })
    const second = rows.get()
    expect(second).not.toBe(first)
    expect(second).toEqual([{ name: 'a' }, { name: 'c' }])
    dispose()
  })

  // A pointer handler or a test reads with nothing observing, and mobx keeps
  // no value between such reads.
  it('hands back the same value across reads nothing observes', () => {
    const regions = observable.map<number, string[]>([[0, ['a']]])
    const rows = rowsOver(regions)
    const first = rows.get()
    expect(rows.get()).toBe(first)
    runInAction(() => {
      regions.set(1, ['a'])
    })
    expect(rows.get()).toBe(first)
  })
})
