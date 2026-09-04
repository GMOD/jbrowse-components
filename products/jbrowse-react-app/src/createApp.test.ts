import { suppressTeardownNoise } from '@jbrowse/display-test-utils'
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

suppressTeardownNoise()

test('createApp opens the declarative views', async () => {
  const controller = await createApp(mount(), {
    assemblies,
    views: [
      { type: 'LinearGenomeView', assembly: 'volvox' },
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

// The `views` prop is the only way a host can describe a view, so a setting it
// cannot express is a setting the host cannot make. It used to carry `type`,
// `id` and a nested `init` and nothing else, which left the deprecation warning
// below unactionable: it asks for the flat shape the prop had no room for.
test('a launch key and a persisted property both land written flat', async () => {
  const controller = await createApp(mount(), {
    assemblies,
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-10',
        colorByCDS: true,
      },
    ],
  })

  const view = controller.viewState.session.views[0]!
  expect(view.launch).toMatchObject({ assembly: 'volvox', loc: 'ctgA:1-10' })
  expect(view.colorByCDS).toBe(true)

  controller.destroy()
})

// afterAttach reports on a later tick than createApp returns on
const settled = () => new Promise(resolve => setTimeout(resolve, 0))

test('a flat view warns about nothing, a nested init is refused', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  const flat = await createApp(mount(), {
    assemblies,
    views: [{ type: 'LinearGenomeView', assembly: 'volvox', colorByCDS: true }],
  })
  await settled()
  expect(warn).not.toHaveBeenCalled()
  flat.destroy()

  const nested = await createApp(mount(), {
    assemblies,
    views: [{ type: 'LinearGenomeView', init: { assembly: 'volvox' } }],
  })
  await settled()
  expect(warn).toHaveBeenCalledWith(
    'LinearGenomeView nests its settings under "init", which is deprecated: write every setting directly on the view object.',
  )
  expect(nested.viewState.session.views[0]!.pendingLaunch).toBeDefined()
  nested.destroy()

  warn.mockRestore()
})

test('addView takes the flat shape too', async () => {
  const controller = await createApp(mount(), { assemblies })

  const id = controller.addView({
    type: 'LinearGenomeView',
    assembly: 'volvox',
    colorByCDS: true,
  })

  const view = controller.viewState.session.views[0]!
  expect(view.id).toBe(id)
  expect(view.launch).toMatchObject({ assembly: 'volvox' })
  expect(view.colorByCDS).toBe(true)

  controller.destroy()
})

test('addView opens another view after launch', async () => {
  const controller = await createApp(mount(), { assemblies })

  controller.addView({ type: 'LinearGenomeView', id: 'later' })

  const { views } = controller.viewState.session
  expect(views).toHaveLength(1)
  expect(views[0]!.id).toBe('later')

  controller.destroy()
})

test('createApp restores a serialized session in place of views', async () => {
  const controller = await createApp(mount(), {
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
test('destroy tears down the engine, not just the React root', async () => {
  const controller = await createApp(mount(), { assemblies })
  const { viewState } = controller
  const destroyDrivers = jest.spyOn(viewState.rpcManager, 'destroy')

  expect(isAlive(viewState)).toBe(true)

  controller.destroy()

  expect(destroyDrivers).toHaveBeenCalled()
  expect(isAlive(viewState)).toBe(false)
})

test('destroy is idempotent', async () => {
  const controller = await createApp(mount(), { assemblies })

  controller.destroy()
  expect(() => {
    controller.destroy()
  }).not.toThrow()
})

// `session` is a mount option, but the state a host wants to apply often arrives
// later — a URL the user pasted, a saved view they picked from a list. Without
// this the only way to swap it is to destroy the app and build another.
test('setSession replaces the session after launch', async () => {
  const controller = await createApp(mount(), {
    assemblies,
    views: [{ type: 'LinearGenomeView' }],
  })

  await controller.setSession({
    name: 'restored',
    views: [{ id: 'v', type: 'CircularView' }],
  })

  const { session } = controller.viewState
  expect(session.name).toBe('restored')
  expect(session.views).toHaveLength(1)
  expect(session.views[0]!.type).toBe('CircularView')

  controller.destroy()
})

test('setSession with nothing returns to the launch views', async () => {
  const controller = await createApp(mount(), {
    assemblies,
    sessionName: 'launch',
    views: [{ type: 'LinearGenomeView' }],
  })
  await controller.setSession({ name: 'restored' })

  await controller.setSession()

  const { session } = controller.viewState
  expect(session.name).toMatch(/^launch /)
  expect(session.views).toHaveLength(1)
  expect(session.views[0]!.type).toBe('LinearGenomeView')

  controller.destroy()
})

// with no id given the view gets a generated one, which the host has no other
// way to learn — leaving removeView, which takes an id, unusable for it
test('addView returns the id removeView takes', async () => {
  const controller = await createApp(mount(), { assemblies })

  const id = controller.addView({ type: 'LinearGenomeView' })
  expect(id).toBeTruthy()

  controller.removeView(id)
  expect(controller.viewState.session.views).toHaveLength(0)

  controller.destroy()
})

// The read-backs a host whose state lives off the page needs (a notebook
// kernel, an R session). Both of ours hand-rolled these before they lived here,
// and both captured `viewState.session` outside the autorun — which setSession
// replaces wholesale, so every read-back went dead on the first session restore.
test('the read-backs survive a setSession', async () => {
  const sessions: unknown[] = []
  const controller = await createApp(mount(), {
    assemblies,
    views: [{ type: 'LinearGenomeView', id: 'first' }],
    onSessionChange: session => sessions.push(session),
  })
  expect(sessions).toHaveLength(1)

  await controller.setSession({
    name: 'restored',
    views: [{ id: 'v', type: 'CircularView' }],
  })

  // the restore itself reports, against the NEW session node
  expect(sessions.length).toBeGreaterThan(1)

  // and the new node is still observed: opening another view reports again
  const before = sessions.length
  await controller.launchView({ type: 'CircularView', id: 'later' })
  expect(sessions.length).toBeGreaterThan(before)

  controller.destroy()
})

test('destroy stops the read-backs', async () => {
  const locations: unknown[] = []
  const controller = await createApp(mount(), {
    assemblies,
    onLocationChange: locs => locations.push(locs),
  })
  controller.destroy()

  // touching the controller after destroy reads a dead node, and MST warns to
  // the console on its way to throwing — the throw is what's under test here
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const after = locations.length
  expect(() => {
    controller.addView({ type: 'CircularView' })
  }).toThrow()
  warn.mockRestore()
  expect(locations).toHaveLength(after)
})

test('removeView closes a view, and ignores an unknown id', async () => {
  const controller = await createApp(mount(), {
    assemblies,
    views: [
      { type: 'LinearGenomeView', id: 'keep' },
      { type: 'CircularView', id: 'drop' },
    ],
  })

  controller.removeView('drop')
  expect(controller.viewState.session.views).toHaveLength(1)
  expect(controller.viewState.session.views[0]!.id).toBe('keep')

  expect(() => {
    controller.removeView('never-existed')
  }).not.toThrow()
  expect(controller.viewState.session.views).toHaveLength(1)

  controller.destroy()
})
