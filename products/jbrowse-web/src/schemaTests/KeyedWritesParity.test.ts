import PluginManager from '@jbrowse/core/PluginManager'
import {
  applyConfSettings,
  mergeConfSettings,
} from '@jbrowse/core/configuration'
import { mergeTrackConfig } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { displayForms } from '@jbrowse/product-core'

import { configManifest } from '../../../jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { mergeBySlots } from '../../../jbrowse-cli/src/commands/validate/liftConfig.ts'
import corePlugins from '../corePlugins.ts'

// ADR-257's one table of (base, write) cases, pushed through the four
// consumers of the keyed write rule on a registered display's own schema:
// the displayDefaults fold (`mergeConfSettings`), a settings bag
// (`applyConfSettings`), a stored share-link delta (`mergeTrackConfig`) and
// the CLI's `mergeBySlots` over the manifest's slots. Each result is read
// back through the schema, so two spellings of one setting compare equal.

const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

type Bag = Record<string, unknown>

function created(displayType: string, snapshot: Bag) {
  return pluginManager
    .getDisplayType(displayType)
    .configSchema.create({ ...snapshot, type: displayType, displayId: 't-d' })
}

function rowsOf(displayType: string, snapshot: Bag) {
  return getSnapshot<Bag>(created(displayType, snapshot).rows)
}

function throughAllFour(displayType: string, base: Bag, write: Bag) {
  const schema = pluginManager.getDisplayType(displayType).configSchema
  const conf = created(displayType, base)
  applyConfSettings(conf, write)
  const track = {
    trackId: 't',
    type: 'FeatureTrack',
    displays: [{ type: displayType, displayId: 't-d', ...base }],
  }
  const delta = mergeTrackConfig(
    track,
    { trackId: 't', displays: [{ displayId: 't-d', ...write }] },
    displayForms(pluginManager),
  ).displays[0]!
  const slots = configManifest.displays[displayType]?.slots ?? []
  return {
    mergeConfSettings: rowsOf(
      displayType,
      mergeConfSettings(schema, base, write),
    ),
    applyConfSettings: getSnapshot<Bag>(conf.rows),
    trackConfigDelta: rowsOf(displayType, delta),
    mergeBySlots: rowsOf(displayType, mergeBySlots(base, write, slots)),
  }
}

const PROVENANCE = { regions: [{ refName: 'chr1', start: 0, end: 100 }] }
const OTHER_PROVENANCE = { regions: [{ refName: 'chr2', start: 0, end: 100 }] }
const CLUSTERED = { newick: '(a,b);', provenance: PROVENANCE }

const arrangement = {
  sort: ['b', 'a'],
  labels: { a: 'A' },
  colors: { a: '#f00' },
  step: 8,
}

const arranged = { rows: { field: 'source', ...arrangement } }

const hosted = {
  sort: ['NA12878 HP1', 'NA12891'],
  labels: { NA12878: 'Child' },
  colors: { NA12891: '#f00' },
}

const cases: {
  name: string
  display: string
  base: Bag
  write: Bag
  rows: Bag
}[] = [
  {
    name: 'a new field unsets the keyed members and keeps the rest',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: 'tissue' },
    rows: { field: 'tissue', step: 8 },
  },
  {
    name: 'a new field keeps the keyed members it states',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: { field: 'tissue', sort: ['x'] } },
    rows: { field: 'tissue', sort: ['x'], step: 8 },
  },
  {
    name: 'a new field keeps the pins it states, and only those',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: { field: 'tissue', colors: { liver: '#0f0' } } },
    rows: { field: 'tissue', colors: { liver: '#0f0' }, step: 8 },
  },
  {
    name: 'a new field stated after a keyed member still keeps that member',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: { sort: ['x'], field: 'tissue' } },
    rows: { field: 'tissue', sort: ['x'], step: 8 },
  },
  {
    name: 'restating the field in force keeps the arrangement',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: 'source' },
    rows: arranged.rows,
  },
  {
    name: 'a member write without the field merges',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: { sort: ['a', 'b'] } },
    rows: { ...arranged.rows, sort: ['a', 'b'] },
  },
  {
    name: 'null resets one member',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: { labels: null } },
    rows: { field: 'source', sort: ['b', 'a'], colors: { a: '#f00' }, step: 8 },
  },
  {
    name: 'a write over a bare field unsets nothing it did not hold',
    display: 'LinearMarkDisplay',
    base: { rows: 'source' },
    write: { rows: 'tissue' },
    rows: { field: 'tissue' },
  },
  {
    name: 'a new field drops the tree with its provenance',
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', tree: CLUSTERED } },
    write: { rows: 'tissue' },
    rows: { field: 'tissue' },
  },
  {
    name: 'a new field stating only a provenance keeps no old newick',
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', sort: ['b', 'a'], tree: CLUSTERED } },
    write: {
      rows: { field: 'tissue', tree: { provenance: OTHER_PROVENANCE } },
    },
    rows: { field: 'tissue', tree: { provenance: OTHER_PROVENANCE } },
  },
  {
    name: 'a new field stating a tree as a newick keeps no old provenance',
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', tree: CLUSTERED } },
    write: { rows: { field: 'tissue', tree: '(x,y);' } },
    rows: { field: 'tissue', tree: { newick: '(x,y);' } },
  },
  {
    name: 'a tree written as a newick drops the clustered provenance',
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', tree: CLUSTERED } },
    write: { rows: { tree: '(b,a);' } },
    rows: { field: 'source', tree: { newick: '(b,a);' } },
  },
  {
    name: 'a newick member write drops the clustered provenance',
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', tree: CLUSTERED } },
    write: { rows: { tree: { newick: '(b,a);' } } },
    rows: { field: 'source', tree: { newick: '(b,a);' } },
  },
  {
    name: 'emptying the newick drops the clustered provenance',
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', tree: CLUSTERED } },
    write: { rows: { tree: { newick: '' } } },
    rows: { field: 'source', tree: { newick: '' } },
  },
  {
    name: 'a write over an empty field resets nothing',
    display: 'LinearMarkDisplay',
    base: { rows: { sort: ['b', 'a'], labels: { a: 'A' } } },
    write: { rows: 'sample' },
    rows: { field: 'sample', sort: ['b', 'a'], labels: { a: 'A' } },
  },
  {
    name: 'a write to an empty field resets nothing',
    display: 'LinearMarkDisplay',
    base: arranged,
    write: { rows: { field: '' } },
    rows: arrangement,
  },
  {
    name: "a write to an empty field keeps the tree's provenance",
    display: 'LinearMarkDisplay',
    base: { rows: { field: 'source', tree: CLUSTERED } },
    write: { rows: { field: '' } },
    rows: { tree: CLUSTERED },
  },
  {
    name: 'a write to the field a field refines keeps the arrangement',
    display: 'LinearVariantDisplay',
    base: { rows: { field: 'haplotype', ...hosted } },
    write: { rows: 'sample' },
    rows: { ...hosted },
  },
  {
    name: 'a write to a field refining the one in force keeps the arrangement',
    display: 'LinearVariantDisplay',
    base: { rows: { field: 'sample', ...hosted } },
    write: { rows: { field: 'haplotype' } },
    rows: { field: 'haplotype', ...hosted },
  },
  {
    name: 'a refinement stating a keyed member merges it over the rest',
    display: 'LinearVariantDisplay',
    base: { rows: { field: 'sample', ...hosted, tree: CLUSTERED } },
    write: { rows: { field: 'haplotype', sort: ['NA12891 HP2'] } },
    rows: {
      field: 'haplotype',
      ...hosted,
      sort: ['NA12891 HP2'],
      tree: CLUSTERED,
    },
  },
]

test.each(cases)('$name, through all four consumers', c => {
  const { display, base, write, rows } = c
  expect(throughAllFour(display, base, write)).toEqual({
    mergeConfSettings: rows,
    applyConfSettings: rows,
    trackConfigDelta: rows,
    mergeBySlots: rows,
  })
})
