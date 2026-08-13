import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { runInAction } from 'mobx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const sequenceConf = (name: string) => ({
  trackId: `${name}-ref`,
  type: 'ReferenceSequenceTrack',
  adapter: {
    type: 'FromConfigSequenceAdapter',
    features: [
      { refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 10, seq: 'acgt' },
    ],
  },
})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    aliases: ['vvx'],
    sequence: sequenceConf('volvox'),
  })
  const reported: string[] = []
  getEnv(session).pluginManager.observeExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    ({ assemblyName }) => {
      reported.push(assemblyName)
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

// The models are what resolve an alias, and they do not exist on the first
// render — the autorun that builds them is a reaction, so inside the action
// that adds the config it has not run yet, which is the window an import form
// mounts in. An alias was unknown for all of it, which reads as "this session
// has no such assembly" rather than "ask again in a moment". The configs name
// their own aliases and are there from the start.
test('has() answers for an alias before the models are built', () => {
  const { session } = setup()
  const { assemblyManager } = session
  runInAction(() => {
    session.addAssemblyConf({
      name: 'other',
      aliases: ['oth'],
      sequence: sequenceConf('other'),
    })
    // the window: the config is in, the model the alias resolves through is not
    expect(assemblyManager.assemblyNameMap.other).toBeUndefined()
    expect(assemblyManager.has('other')).toBe(true)
    expect(assemblyManager.has('oth')).toBe(true)
  })
  // and once the reaction has run, through the models as before
  expect(assemblyManager.assemblyNameMap.oth).toBeDefined()
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
