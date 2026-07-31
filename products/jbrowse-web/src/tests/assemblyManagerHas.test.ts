import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    aliases: ['vvx'],
    sequence: {
      trackId: 'volvox-ref',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 10, seq: 'acgt' },
        ],
      },
    },
  })
  const reported: string[] = []
  getEnv(session).pluginManager.addToExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    (defaultResult: unknown, props: Record<string, unknown>) => {
      const { assemblyName } = props
      if (typeof assemblyName === 'string') {
        reported.push(assemblyName)
      }
      return defaultResult
    },
  )
  return { session, reported }
}

test('has() answers for the canonical name and for an alias', () => {
  const { session } = setup()
  expect(session.assemblyManager.has('volvox')).toBe(true)
  expect(session.assemblyManager.has('vvx')).toBe(true)
  expect(session.assemblyManager.has('nonexistent')).toBe(false)
})

// The reason has() exists. A caller probing with get() tells every installed
// plugin to go resolve a name — on genomes.jbrowse.org, a connection to a
// config that 404s — even when it is about to supply the assembly itself.
test('has() never reports to Core-handleUnrecognizedAssembly, get() does', () => {
  const { session, reported } = setup()
  session.assemblyManager.has('nonexistent')
  session.assemblyManager.has('volvox')
  expect(reported).toEqual([])

  session.assemblyManager.get('volvox')
  expect(reported).toEqual([])

  session.assemblyManager.get('nonexistent')
  expect(reported).toEqual(['nonexistent'])
})
