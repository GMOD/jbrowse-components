import { isAlive } from '@jbrowse/mobx-state-tree'

import { createApp } from './createApp.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  },
]

function mount() {
  const el = document.createElement('div')
  document.body.append(el)
  return el
}

test('createApp opens the declarative views', () => {
  const controller = createApp(mount(), {
    assemblies,
    views: [
      { type: 'LinearGenomeView', init: { assembly: 'volvox' } },
      { type: 'CircularView', id: 'circ' },
    ],
  })

  const { views } = controller.viewState.session
  expect(views).toHaveLength(2)
  expect(views[0]!.type).toBe('LinearGenomeView')
  expect(views[1]!.type).toBe('CircularView')
  expect(views[1]!.id).toBe('circ')

  controller.destroy()
})

test('addView opens another view after launch', () => {
  const controller = createApp(mount(), { assemblies })

  controller.addView({ type: 'LinearGenomeView', id: 'later' })

  const { views } = controller.viewState.session
  expect(views).toHaveLength(1)
  expect(views[0]!.id).toBe('later')

  controller.destroy()
})

test('createApp restores a serialized session in place of views', () => {
  const controller = createApp(mount(), {
    assemblies,
    views: [{ type: 'LinearGenomeView' }],
    session: { name: 'restored', views: [{ id: 'v', type: 'CircularView' }] },
  })

  const { session } = controller.viewState
  expect(session.name).toBe('restored')
  expect(session.views).toHaveLength(1)
  expect(session.views[0]!.type).toBe('CircularView')

  controller.destroy()
})

// React unmount does not own the engine: without an explicit teardown the MST
// tree stays alive with its autoruns running and its RPC worker pool orphaned,
// which is a per-mount leak for hosts that mount and discard repeatedly (a
// Jupyter cell re-run, an SPA route change).
test('destroy tears down the engine, not just the React root', () => {
  const controller = createApp(mount(), { assemblies })
  const { viewState } = controller
  const destroyDrivers = jest.spyOn(viewState.rpcManager, 'destroy')

  expect(isAlive(viewState)).toBe(true)

  controller.destroy()

  expect(destroyDrivers).toHaveBeenCalled()
  expect(isAlive(viewState)).toBe(false)
})

test('destroy is idempotent', () => {
  const controller = createApp(mount(), { assemblies })

  controller.destroy()
  expect(() => {
    controller.destroy()
  }).not.toThrow()
})
