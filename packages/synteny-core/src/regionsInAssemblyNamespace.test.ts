import { types } from '@jbrowse/mobx-state-tree'

import {
  adapterAssemblyNames,
  regionsInAssemblyNamespace,
} from './regionsInAssemblyNamespace.ts'
import { assemblyManager } from './testUtils.ts'

const region = { assemblyName: 'a', refName: 'chr1', start: 0, end: 10 }

// The adapter compares config text in a worker with no assembly manager, so a
// view on `a` querying a track that declared `aliasOfA` got `[]` from
// `facingSides` and an empty band. The rewrite is the main-thread half of that
// comparison: the spelling the adapter will recognize, decided where the
// aliases are known.
test('a region takes the spelling the adapter declared for its assembly', () => {
  expect(
    regionsInAssemblyNamespace([region], ['aliasOfA', 'b'], assemblyManager),
  ).toEqual([{ ...region, assemblyName: 'aliasOfA' }])
})

test('a region already in the adapter spelling is the same object', () => {
  const [same] = regionsInAssemblyNamespace(
    [region],
    ['a', 'b'],
    assemblyManager,
  )
  expect(same).toBe(region)
})

// An all-vs-all file's undeclared PanSN samples, or a caller with the wrong
// track: nothing to respell to, so the adapter sees what the view said and
// answers for itself.
test('a region no declared name resolves to stays as written', () => {
  const [same] = regionsInAssemblyNamespace(
    [region],
    ['grape', 'peach'],
    assemblyManager,
  )
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
  const [out] = regionsInAssemblyNamespace(
    [...row.regions],
    ['aliasOfA'],
    assemblyManager,
  )
  expect(out).toEqual({ ...region, assemblyName: 'aliasOfA' })
  expect(out).not.toBe(row.regions[0])
})

test('adapterAssemblyNames reads the array, else the named pair', () => {
  expect(adapterAssemblyNames({ assemblyNames: ['q', 't'] })).toEqual([
    'q',
    't',
  ])
  expect(
    adapterAssemblyNames({
      assemblyNames: [],
      queryAssembly: 'q',
      targetAssembly: 't',
    }),
  ).toEqual(['q', 't'])
  expect(adapterAssemblyNames({ type: 'MCScanBlocksAdapter' })).toEqual([])
})
