import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// `name` is the assembly config's MST identifier, and the assemblyManager holds
// each assembly's config as a safeReference to it. A second config carrying a
// name one of the other arrays already has is accepted by the push and only
// fails later, on every read of `assembly.configuration`, with "Cannot resolve a
// reference ... unambigously" — thrown from inside the manager's own autorun and
// from assemblyNameMap, i.e. the session is gone. So the three arrays the
// manager draws on (jbrowse.assemblies, sessionAssemblies, temporaryAssemblies)
// are one namespace and every add path checks all of it.
const VOLVOX = {
  name: 'volvox',
  aliases: ['vvx'],
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

// reading these is what used to throw
function assertHealthy(session: ReturnType<typeof setup>) {
  const { assemblyManager } = session
  expect(assemblyManager.assemblyNamesList).toEqual(['volvox'])
  expect(Object.keys(assemblyManager.assemblyNameMap).sort()).toEqual([
    'volvox',
    'vvx',
  ])
  expect(assemblyManager.has('volvox')).toBe(true)
  expect(assemblyManager.get('volvox')).toBeTruthy()
}

test('addSessionAssembly rejects a name jbrowse.assemblies already has', () => {
  const session = setup()
  console.warn = jest.fn()

  const existing = session.addSessionAssembly({ ...VOLVOX })

  expect(session.sessionAssemblies).toHaveLength(0)
  // the caller gets the assembly that already covers the name
  expect(existing?.name).toBe('volvox')
  assertHealthy(session)
})

test('addTemporaryAssembly rejects a name jbrowse.assemblies already has', () => {
  const session = setup()
  console.warn = jest.fn()

  session.addTemporaryAssembly({ ...VOLVOX })

  expect(session.temporaryAssemblies).toHaveLength(0)
  assertHealthy(session)
})

test('addAssembly rejects a name a session assembly already has', () => {
  const session = setup()
  console.warn = jest.fn()
  session.addSessionAssembly({ ...VOLVOX, name: 'other' })

  session.addAssembly({ ...VOLVOX, name: 'other' })

  expect(session.sessionAssemblies).toHaveLength(1)
  expect(session.assemblyManager.assemblyNamesList).toEqual(['volvox', 'other'])
})

test('a new name still goes in', () => {
  const session = setup()
  session.addSessionAssembly({ ...VOLVOX, name: 'volvox2', aliases: [] })
  expect(session.assemblyManager.assemblyNamesList).toEqual([
    'volvox',
    'volvox2',
  ])
  expect(session.assemblyManager.get('volvox2')).toBeTruthy()
})

// Each unresolved name goes to the extension point once. get() is called from
// render paths and computeds, so reporting on every miss made a handler that
// answers by fetching (the hubs plugin probes a config url) re-fetch on every
// re-render, forever, for exactly the names nothing can supply.
test('Core-handleUnrecognizedAssembly hears each name once per session', () => {
  const session = setup()
  const reported: string[] = []
  getEnv(session).pluginManager.addToExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    (defaultResult: unknown, props: Record<string, unknown>) => {
      reported.push(props.assemblyName as string)
      return defaultResult
    },
  )

  for (let i = 0; i < 10; i++) {
    session.assemblyManager.get('nope')
    session.assemblyManager.get('alsoNope')
  }

  expect(reported).toEqual(['nope', 'alsoNope'])
})

test('a name supplied after being reported is not reported again', () => {
  const session = setup()
  const reported: string[] = []
  getEnv(session).pluginManager.addToExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    (defaultResult: unknown, props: Record<string, unknown>) => {
      reported.push(props.assemblyName as string)
      return defaultResult
    },
  )

  expect(session.assemblyManager.get('volvox2')).toBeUndefined()
  session.addSessionAssembly({ ...VOLVOX, name: 'volvox2', aliases: [] })
  expect(session.assemblyManager.get('volvox2')).toBeTruthy()
  expect(reported).toEqual(['volvox2'])
})
