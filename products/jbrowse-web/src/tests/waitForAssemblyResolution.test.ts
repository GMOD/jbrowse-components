import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// waitForAssembly used to give an unknown name a flat 10s and then return
// undefined, so a caller (renameRegionsIfNeeded, and through it every adapter
// fetch) silently proceeded with an empty refName map on a slow resolve, and sat
// for ten seconds on one that was never coming. Resolution is a chain of
// observable events, so it is waited on as one: the handler's own promise, then
// any connection still fetching. Nothing here advances a clock — every test
// finishes on the events, well inside jest's own 5s default, which is itself the
// assertion that the 10s grace was not taken.
const VOLVOX = {
  name: 'volvox',
  sequence: {
    trackId: 'volvox-ref',
    type: 'ReferenceSequenceTrack',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'ctgA',
          start: 0,
          end: 10,
          seq: 'acgtacgtac',
        },
      ],
    },
  },
}

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(VOLVOX)
  return session
}

function onUnrecognized(
  session: ReturnType<typeof setup>,
  cb: (assemblyName: string) => unknown,
) {
  getEnv(session).pluginManager.addToExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    (defaultResult: unknown, props: Record<string, unknown>) =>
      cb(props.assemblyName as string) ?? defaultResult,
  )
}

test('a handler that returns a promise is waited on, however late it supplies', async () => {
  const session = setup()
  onUnrecognized(session, async name => {
    // stands in for the hubs plugin's HEAD probe: nothing about this is
    // observable from the session, which is why the promise is the signal
    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })
    session.addSessionAssembly({ ...VOLVOX, name })
  })

  const asm = await session.assemblyManager.waitForAssembly('volvox2')
  expect(asm?.name).toBe('volvox2')
  expect(asm?.initialized).toBe(true)
})

test('a handler that returns a promise and supplies nothing gives up when it settles', async () => {
  const session = setup()
  let settled = false
  onUnrecognized(session, async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })
    settled = true
  })

  expect(await session.assemblyManager.waitForAssembly('nope')).toBeUndefined()
  // it waited for the handler rather than returning on the spot, and did not
  // wait out the grace either
  expect(settled).toBe(true)
})

test('a handler that rejects still ends the wait', async () => {
  const session = setup()
  onUnrecognized(session, () => Promise.reject(new Error('probe failed')))
  expect(await session.assemblyManager.waitForAssembly('nope')).toBeUndefined()
})

// The contract before a handler could return a promise, which every published
// hubs bundle up to 1.0.13 uses: kick the work off and return the accumulator.
// Nothing about that is observable, so the wait falls back to a bounded one —
// but it still ends on the assembly appearing, not on the bound.
test('a fire-and-forget handler still resolves, on the event not the bound', async () => {
  const session = setup()
  onUnrecognized(session, name => {
    setTimeout(() => {
      session.addSessionAssembly({ ...VOLVOX, name })
    }, 50)
    // returns undefined, i.e. tells us nothing
  })

  const asm = await session.assemblyManager.waitForAssembly('volvox2')
  expect(asm?.name).toBe('volvox2')
})

test('no handler at all returns immediately for a name nothing knows', async () => {
  const session = setup()
  // no Core-handleUnrecognizedAssembly registered, so `reports` records the
  // name with no claim; there is nothing to wait on and no connection loading
  expect(await session.assemblyManager.waitForAssembly('nope')).toBeUndefined()
})

test('an assembly already in the session resolves without consulting a handler', async () => {
  const session = setup()
  const reported: string[] = []
  onUnrecognized(session, name => {
    reported.push(name)
  })

  const asm = await session.assemblyManager.waitForAssembly('volvox')
  expect(asm?.name).toBe('volvox')
  expect(asm?.regions?.[0]?.refName).toBe('ctgA')
  expect(reported).toEqual([])
})

test('concurrent waiters share the one resolution attempt', async () => {
  const session = setup()
  let calls = 0
  onUnrecognized(session, async name => {
    calls++
    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })
    session.addSessionAssembly({ ...VOLVOX, name })
  })

  const [a, b] = await Promise.all([
    session.assemblyManager.waitForAssembly('volvox2'),
    session.assemblyManager.waitForAssembly('volvox2'),
  ])
  expect(a?.name).toBe('volvox2')
  expect(b?.name).toBe('volvox2')
  expect(calls).toBe(1)
})

test('waitForAssembly rejects an empty name rather than waiting on nothing', async () => {
  const session = setup()
  await expect(session.assemblyManager.waitForAssembly('')).rejects.toThrow(
    /no assembly name/,
  )
})
