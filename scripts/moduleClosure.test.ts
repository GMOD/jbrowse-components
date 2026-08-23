import { join } from 'node:path'

import { closure } from './moduleClosure.ts'

// Ceilings, not measurements: the numbers beside each entry are what it costs
// today (`node --experimental-strip-types scripts/moduleClosure.ts` prints
// them), and the ceiling is roughly half again as much. A file here failing
// means a new import edge pulled a graph in — usually one written through a
// barrel. `agent-docs/ideas/barrels-block-extraction.md` is the writeup.
//
// The type ceilings on the three `util/` leaves are the load-bearing ones: each
// is a coordinate or file-location helper, and reaching a few hundred files
// means `Region` or `FileLocation` came from `util/types/index.ts` — the
// session family — rather than from `util/types/data.ts` beside it.
//
// The fetch harness now has type ceilings too. They were ~370 apiece until the
// session interface split (`agent-docs/ideas/lightweight-toolkit.md` §2): each
// of these files reaches its host for one service, and a `getSession` — whose
// return type is the whole application — is what would put the 370 back.

const root = join(__dirname, '..')

const CEILINGS = [
  // 8 runtime / 48 type
  {
    entry:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/fetchEachRegion.ts',
    runtime: 20,
    types: 70,
  },
  // 18 runtime / 44 type
  {
    entry:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts',
    runtime: 30,
    types: 70,
  },
  // 44 runtime, of which the track-config read is most. No type ceiling: it
  // reads a track's assembly names off a config, which is the configuration
  // schemas and therefore the whole graph.
  {
    entry:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/installPerRegionFetchAutoruns.ts',
    runtime: 60,
  },
  // 4 runtime / 35 type
  { entry: 'packages/core/src/util/fetchContext.ts', runtime: 15, types: 55 },
  // 14 runtime / 40 type
  { entry: 'packages/core/src/util/installFetch.ts', runtime: 30, types: 60 },
  // 4 runtime / 35 type
  {
    entry: 'packages/core/src/util/installInitAutorun.ts',
    runtime: 15,
    types: 55,
  },
  // 4 runtime / 8 type
  { entry: 'packages/core/src/util/locString.ts', runtime: 10, types: 20 },
  // 2 runtime / 6 type
  { entry: 'packages/core/src/util/bpUtils.ts', runtime: 10, types: 20 },
  // 3 runtime / 6 type
  {
    entry: 'packages/core/src/util/assemblyConfigUtils.ts',
    runtime: 10,
    types: 20,
  },
]

test.each(CEILINGS)('$entry stays a leaf', ({ entry, runtime, types }) => {
  const file = join(root, entry)
  expect(closure(file, false).files.size).toBeLessThanOrEqual(runtime)
  if (types !== undefined) {
    expect(closure(file, true).files.size).toBeLessThanOrEqual(types)
  }
})
