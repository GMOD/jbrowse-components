import { types } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import { installInitAutorun } from './installInitAutorun.ts'

interface Init {
  tag: string
}

function setup(
  apply: (init: Init, ctx: { superseded: () => boolean }) => Promise<void>,
) {
  const notified: string[] = []

  const View = types
    .model('TestView', {
      launch: types.frozen<Init | undefined>(),
    })
    .volatile(() => ({
      ready: false,
      materialized: false,
      error: undefined as unknown,
    }))
    .views(self => ({
      get pendingLaunch() {
        return self.launch
      },
    }))
    .actions(self => ({
      setLaunch(launch?: Init) {
        self.launch = launch
      },
      setError(error: unknown) {
        self.error = error
      },
      setReady(ready: boolean) {
        self.ready = ready
      },
      setMaterialized(materialized: boolean) {
        self.materialized = materialized
      },
    }))
    .actions(self => ({
      afterAttach() {
        installInitAutorun(self, {
          name: 'TestInit',
          ready: () => self.ready,
          materialized: () => self.materialized,
          apply,
        })
      },
    }))

  // isSessionModel is a duck-type check for these two members
  const Session = types
    .model('TestSession', {
      view: View,
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
    }))
    .actions(() => ({
      notifyError(message: string) {
        notified.push(message)
      },
    }))

  const session = Session.create({ view: { init: { tag: 'first' } } })
  return { view: session.view, notified }
}

// resolve after the microtasks the drain loop queues have run
async function settle() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

test('gates on ready, then applies and clears init', async () => {
  const applied: Init[] = []
  const { view } = setup(async init => {
    applied.push(init)
  })

  await settle()
  expect(applied).toHaveLength(0)

  view.setReady(true)
  await when(() => view.pendingLaunch === undefined)
  expect(applied.map(i => i.tag)).toEqual(['first'])
})

// The clobber LGV's identity check was added for: without it the pending init
// is dropped, and the view keeps whatever the superseded one applied.
test('an init that lands mid-apply is applied, not dropped', async () => {
  const applied: Init[] = []
  let inFlight: (() => void) | undefined
  const { view } = setup(async init => {
    applied.push(init)
    if (init.tag === 'first') {
      await new Promise<void>(resolve => {
        inFlight = resolve
      })
    }
  })

  view.setReady(true)
  await when(() => !!inFlight)
  view.setLaunch({ tag: 'second' })
  inFlight!()

  await when(() => view.pendingLaunch === undefined)
  expect(applied.map(i => i.tag)).toEqual(['first', 'second'])
})

// `ready` flips true→false→true on a StrictMode remount or a dockview
// re-mount, re-firing the autorun mid-apply. Overlapping applies duplicate
// whatever the init appends, and where apply rebuilds sub-views the second run
// detaches the models the first is still awaiting.
test('ready churn mid-apply does not run a second apply', async () => {
  let calls = 0
  let inFlight: (() => void) | undefined
  const { view } = setup(async () => {
    calls++
    await new Promise<void>(resolve => {
      inFlight = resolve
    })
  })

  view.setReady(true)
  await when(() => !!inFlight)
  view.setReady(false)
  view.setReady(true)
  await settle()
  expect(calls).toBe(1)

  inFlight!()
  await when(() => view.pendingLaunch === undefined)
  expect(calls).toBe(1)
})

// The liveness guarantee a wait ceiling used to provide by guessing. An apply
// parked on state that never arrives holds the drain open, so without this the
// init that replaced it is stranded for as long as the wait lasts — forever,
// once the timer is gone.
test('a mid-apply wait can unpark on being superseded', async () => {
  const applied: Init[] = []
  const { view } = setup(async (init, { superseded }) => {
    if (init.tag === 'first') {
      // the shape every long init wait uses: the condition it wants, or the
      // reasons it will never come
      await when(() => superseded())
    }
    applied.push(init)
  })

  view.setReady(true)
  await settle()
  expect(applied).toHaveLength(0)

  view.setLaunch({ tag: 'second' })
  await when(() => view.pendingLaunch === undefined)
  expect(applied.map(i => i.tag)).toEqual(['first', 'second'])
})

test('a failure after materialization clears init and notifies', async () => {
  const { view, notified } = setup(async () => {
    view.setMaterialized(true)
    throw new Error('late step failed')
  })
  jest.spyOn(console, 'error').mockImplementation()

  view.setReady(true)
  await when(() => view.pendingLaunch === undefined)
  expect(notified).toEqual(['Error: late step failed'])
  // the view still works — setError would drop it to the import form
  expect(view.error).toBeUndefined()
})

test('a failure before materialization keeps init, sets error, does not spin', async () => {
  let calls = 0
  const { view, notified } = setup(async () => {
    calls++
    throw new Error('assembly failed')
  })
  jest.spyOn(console, 'error').mockImplementation()

  view.setReady(true)
  await when(() => !!view.error)
  await settle()

  // kept, so a reload can retry it
  expect(view.pendingLaunch).toEqual({ tag: 'first' })
  // the import form's banner is the whole report — no duplicate snackbar
  expect(notified).toEqual([])
  // and the drain stopped rather than reapplying the init it left in place
  expect(calls).toBe(1)
})
