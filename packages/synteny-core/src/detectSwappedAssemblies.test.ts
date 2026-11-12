import { types } from '@jbrowse/mobx-state-tree'

import {
  detectAssembliesSwapped,
  detectDisplayAssembliesSwapped,
} from './detectSwappedAssemblies.ts'

const mockSession = { current: {} }

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: () => mockSession.current,
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  ...jest.requireActual('@jbrowse/core/util/tracks'),
  getRpcSessionId: () => 'test',
}))

describe('detectAssembliesSwapped', () => {
  // asmA's real refNames are chrA*, asmB's are chrB*
  const realRefNames: Record<string, string[]> = {
    asmA: ['chrA1', 'chrA2'],
    asmB: ['chrB1', 'chrB2'],
  }
  const base = {
    topAssembly: 'asmA',
    bottomAssembly: 'asmB',
    getAssemblyRefNames: (name: string) => realRefNames[name],
    getCanonicalRefName: (_name: string, ref: string) => ref,
  }

  it('flags swap when the adapter reports the bottom assembly names for the top axis', async () => {
    expect(
      await detectAssembliesSwapped({
        ...base,
        getAdapterRefNames: () => Promise.resolve(['chrB1', 'chrB2']),
      }),
    ).toBe(true)
  })

  it('does not flag a correctly ordered pair', async () => {
    expect(
      await detectAssembliesSwapped({
        ...base,
        getAdapterRefNames: () => Promise.resolve(['chrA1', 'chrA2']),
      }),
    ).toBe(false)
  })

  it('uses the majority when reported names are mixed', async () => {
    expect(
      await detectAssembliesSwapped({
        ...base,
        getAdapterRefNames: () => Promise.resolve(['chrB1', 'chrB2', 'chrA1']),
      }),
    ).toBe(true)
  })

  it('canonicalizes reported names before comparing', async () => {
    // File uses "1"/"2"; the bottom assembly canonicalizes "2" -> chrB2
    expect(
      await detectAssembliesSwapped({
        ...base,
        getAdapterRefNames: () => Promise.resolve(['2']),
        getCanonicalRefName: (name, ref) =>
          name === 'asmB' && ref === '2' ? 'chrB2' : ref,
      }),
    ).toBe(true)
  })

  it('does not flag a single self-comparison assembly', async () => {
    expect(
      await detectAssembliesSwapped({
        ...base,
        bottomAssembly: 'asmA',
        getAdapterRefNames: () => Promise.resolve(['chrB1']),
      }),
    ).toBe(false)
  })

  it('does not flag a missing assembly name', async () => {
    expect(
      await detectAssembliesSwapped({
        ...base,
        topAssembly: undefined,
        getAdapterRefNames: () => Promise.resolve(['chrB1']),
      }),
    ).toBe(false)
  })

  it('yields no signal when getRefNames rejects', async () => {
    expect(
      await detectAssembliesSwapped({
        ...base,
        getAdapterRefNames: () => Promise.reject(new Error('not implemented')),
      }),
    ).toBe(false)
  })
})

// The adapter answers `getRefNames` by comparing the name against its config
// text, so a view on `asmA` asking a track that spells it `A` got nothing back
// and the warning could not fire.
test('a display whose adapter names the top assembly by an alias is asked under that alias', async () => {
  const refNames: Record<string, string[]> = {
    asmA: ['chrA1', 'chrA2'],
    asmB: ['chrB1', 'chrB2'],
  }
  const assemblies = new Map(
    Object.entries(refNames).map(([name, names]) => [
      name,
      {
        name,
        refNames: names,
        hasName: (other: string) =>
          other === name || (name === 'asmA' && other === 'A'),
        getCanonicalRefName2: (refName: string) => refName,
      },
    ]),
  )
  const asked: string[] = []
  mockSession.current = {
    assemblyManager: { get: (name: string) => assemblies.get(name) },
    rpcManager: {
      call: async (
        _sessionId: string,
        _method: string,
        { assemblyName }: { assemblyName: string },
      ) => {
        asked.push(assemblyName)
        return assemblyName === 'A' ? refNames.asmB : []
      },
    },
  }
  const display = types
    .model({})
    .volatile(() => ({ adapterConfig: { assemblyNames: ['A', 'asmB'] } }))
    .create()
  expect(await detectDisplayAssembliesSwapped(display, 'asmA', 'asmB')).toBe(
    true,
  )
  expect(asked).toEqual(['A'])
})
