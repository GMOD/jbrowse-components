import { types } from '@jbrowse/mobx-state-tree'

import { regionsInAdapterNamespace } from './regionsInAdapterNamespace.ts'
import { assemblyManager } from './testUtils.ts'

const region = { assemblyName: 'a', refName: 'chr1', start: 0, end: 10 }

// The adapter compares config text in a worker with no assembly manager, so a
// view on `a` querying a track that declared `aliasOfA` got `[]` from
// `facingSides` and an empty band. The rewrite is the main-thread half of that
// comparison: the spelling the adapter will recognize, decided where the
// aliases are known.
test('a region takes the spelling the adapter declared for its assembly', () => {
  expect(
    regionsInAdapterNamespace([region], {
      adapterConfig: { assemblyNames: ['aliasOfA', 'b'] },
      assemblyManager,
    }),
  ).toEqual([{ ...region, assemblyName: 'aliasOfA' }])
})

test('a region already in the adapter spelling is the same object', () => {
  const [same] = regionsInAdapterNamespace([region], {
    adapterConfig: { assemblyNames: ['a', 'b'] },
    assemblyManager,
  })
  expect(same).toBe(region)
})

// An all-vs-all file's undeclared PanSN samples, or a caller with the wrong
// track: nothing to respell to, so the adapter sees what the view said and
// answers for itself.
test('a region no declared name resolves to stays as written', () => {
  const [same] = regionsInAdapterNamespace([region], {
    adapterConfig: { assemblyNames: ['grape', 'peach'] },
    assemblyManager,
  })
  expect(same).toBe(region)
})

// The comparative displays hand over a view's `displayedRegions`, which are MST
// nodes; a respelled copy has to be a plain snapshot rather than a spread of
// the node's own properties.
test('an MST region is respelled as a plain snapshot', () => {
  const Row = types.model({
    regions: types.array(
      types.model({
        assemblyName: types.string,
        refName: types.string,
        start: types.number,
        end: types.number,
      }),
    ),
  })
  const row = Row.create({ regions: [region] })
  const [out] = regionsInAdapterNamespace([...row.regions], {
    adapterConfig: { assemblyNames: ['aliasOfA'] },
    assemblyManager,
  })
  expect(out).toEqual({ ...region, assemblyName: 'aliasOfA' })
  expect(out).not.toBe(row.regions[0])
})

test('the adapter config names lead the track names, which stand in for a config naming none', () => {
  const trackAssemblyNames = ['aliasOfA', 'b']
  expect(
    regionsInAdapterNamespace([region], {
      adapterConfig: { blockAssemblies: ['a', 'b'] },
      trackAssemblyNames,
      assemblyManager,
    }),
  ).toEqual([region])
  expect(
    regionsInAdapterNamespace([region], {
      adapterConfig: { type: 'GbzAdapter' },
      trackAssemblyNames,
      assemblyManager,
    }),
  ).toEqual([{ ...region, assemblyName: 'aliasOfA' }])
})

// `aliasOfA` resolves to `a`, and a config may list it for another assembly
test('a region named as the config names it keeps that name behind an alias listed first', () => {
  const [same] = regionsInAdapterNamespace([region], {
    adapterConfig: { assemblyNames: ['aliasOfA', 'a'] },
    assemblyManager,
  })
  expect(same).toBe(region)
})
