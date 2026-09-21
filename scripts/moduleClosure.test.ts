import { join } from 'node:path'

import { closure } from './moduleClosure.ts'

// Ceilings, not measurements: the numbers beside each entry are what it costs
// today (`node --experimental-strip-types scripts/moduleClosure.ts` prints
// them), and the ceiling is roughly half again as much. A file here failing
// means a new import edge pulled a graph in — usually one written through a
// barrel.
//
// The type ceilings on the three `util/` leaves are the load-bearing ones: each
// is a coordinate or file-location helper, and reaching a few hundred files
// means `Region` or `FileLocation` came from `util/types/index.ts` — the
// session family — rather than from `util/types/data.ts` beside it.
//
// The fetch harness now has type ceilings too. They were ~370 apiece until the
// session interface split (`agent-docs/ideas/waiting-on-a-call/lightweight-toolkit.md` §2): each
// of these files reaches its host for one service, and a `getSession` — whose
// return type is the whole application — is what would put the 370 back.
//
// The three `ui/` entries are the same failure one layer up, and they were
// unguarded until 2026-08-25: `legendSpec.ts` took `ColorLegendEntry` from the
// component that draws it, so a file describing plain data measured 375.
// `menuItems.ts` is the whole builder family in one closure, and its ceiling is
// what keeps a builder from taking a type off a module that renders.
//
// `markEncodingTypes.ts` gets no headroom at all, because it is the file whose
// own header promises this check: it exists so `RpcRegistry.ts` can name
// CoreEncodeFeatures' wire shape without pulling render-core's graph through
// it, and every leaf that reaches the registry pays for an edge added here.
// Its three are itself, `BaseAdapter/zoomRange.ts`, which is a module for one
// interface for this reason — `types.ts` beside it carries the status and
// abort graph through `BaseOptions` — and `colorSchemes.ts`, a module for one
// list for the same reason.

const root = join(__dirname, '..')

const CEILINGS = [
  // 10 runtime / 58 type
  {
    entry: 'packages/display-kit/src/fetchEachRegion.ts',
    runtime: 20,
    types: 70,
  },
  // 18 runtime / 44 type
  {
    entry: 'packages/display-kit/src/FetchMixin.ts',
    runtime: 30,
    types: 70,
  },
  // 57 runtime, of which the track-config read is most. No type ceiling: it
  // reads a track's assembly names off a config, which is the configuration
  // schemas and therefore the whole graph.
  {
    entry: 'packages/display-kit/src/installPerRegionFetchAutoruns.ts',
    runtime: 60,
  },
  // 10 runtime / 37 type
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
  // 1 runtime / 2 type
  { entry: 'packages/core/src/ui/MenuTypes.ts', runtime: 5, types: 10 },
  // 7 runtime / 8 type
  { entry: 'packages/core/src/ui/menuItems.ts', runtime: 12, types: 15 },
  // 1 runtime / 5 type
  { entry: 'packages/core/src/ui/legendSpec.ts', runtime: 5, types: 8 },
  // 1 runtime / 3 type
  {
    entry: 'packages/core/src/util/markEncodingTypes.ts',
    runtime: 5,
    types: 3,
  },
  // 8 runtime / 8 type, and no headroom: `jbrowse validate` carries a copy of
  // every file here (scripts/generateMarkRules.ts), so an edge added to the
  // rule list is a file the CLI publishes.
  {
    entry: 'plugins/marks/src/LinearMarkDisplay/markProblems.ts',
    runtime: 8,
    types: 8,
  },
]

test.each(CEILINGS)('$entry stays a leaf', ({ entry, runtime, types }) => {
  const file = join(root, entry)
  expect(closure(file, false).files.size).toBeLessThanOrEqual(runtime)
  if (types !== undefined) {
    expect(closure(file, true).files.size).toBeLessThanOrEqual(types)
  }
})
