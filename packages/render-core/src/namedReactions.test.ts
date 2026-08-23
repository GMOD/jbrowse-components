import { autorun, observable, runInAction } from 'mobx'

import { reactionDependencies, recordNamedReaction } from './namedReactions.ts'

test('answers the leaf observables a reaction read on its last run', () => {
  const host = {}
  const state = observable({ a: 1, b: 2, gate: false }, undefined, {
    name: 'State',
  })
  const disposer = autorun(() => {
    void state.a
    if (state.gate) {
      void state.b
    }
  })
  recordNamedReaction(host, 'probe', disposer)
  expect(reactionDependencies(host, 'probe')).toEqual(['State.a', 'State.gate'])
  runInAction(() => {
    state.gate = true
  })
  expect(reactionDependencies(host, 'probe')).toEqual([
    'State.a',
    'State.b',
    'State.gate',
  ])
  disposer()
})

test('names the reactions it does know when asked for one it does not', () => {
  const host = {}
  recordNamedReaction(
    host,
    'known',
    autorun(() => {}),
  )
  expect(() => reactionDependencies(host, 'other')).toThrow(/known: known/)
})
