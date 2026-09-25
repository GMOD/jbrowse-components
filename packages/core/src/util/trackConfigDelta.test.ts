import {
  diffTrackConfig,
  flattenTrackConfigDelta,
  mergeTrackConfig,
} from './trackConfigDelta.ts'

interface Display {
  type?: string
  displayId: string
  [k: string]: unknown
}
interface Cfg {
  type?: string
  trackId: string
  name?: string
  category?: string[]
  jexlFilters?: string[]
  adapter?: {
    type: string
    vcfGzLocation: { locationType: string; uri: string }
  }
  displays: Display[]
  [k: string]: unknown
}

const asCfg = (v: Record<string, unknown>) => v as unknown as Cfg
const clone = (v: Cfg) => structuredClone(v)

const base: Cfg = {
  type: 'VariantTrack',
  trackId: 'vcf',
  name: 'my vcf',
  category: ['Variants'],
  adapter: {
    type: 'VcfTabixAdapter',
    vcfGzLocation: { locationType: 'UriLocation', uri: 'v.vcf.gz' },
  },
  displays: [
    { type: 'ChordVariantDisplay', displayId: 'vcf-Chord' },
    { type: 'LinearVariantDisplay', displayId: 'vcf-Linear' },
  ],
}

test('diff of an unchanged config is just the trackId', () => {
  expect(diffTrackConfig(base, clone(base))).toEqual({ trackId: 'vcf' })
})

test('a single display slot edit produces a minimal display-scoped delta', () => {
  const edited = clone(base)
  edited.displays[1]!.height = 250

  const delta = diffTrackConfig(base, edited)
  expect(delta).toEqual({
    trackId: 'vcf',
    displays: [{ displayId: 'vcf-Linear', height: 250 }],
  })
  expect((delta.displays as unknown[]).length).toBe(1)
  expect(delta).not.toHaveProperty('adapter')
})

test('merge reconstructs the edited config from base + delta', () => {
  const edited = clone(base)
  edited.displays[1]!.height = 250
  edited.displays[1]!.color = '#f00'

  const delta = diffTrackConfig(base, edited)
  expect(mergeTrackConfig(base, delta)).toEqual(edited)
})

test('admin change to an untouched field flows through the delta', () => {
  const edited = clone(base)
  edited.displays[1]!.height = 250
  const delta = diffTrackConfig(base, edited)

  const newBase = clone(base)
  newBase.adapter!.vcfGzLocation.uri = 'corrected.vcf.gz'

  const effective = asCfg(mergeTrackConfig(newBase, delta))
  expect(effective.displays[1]!.height).toBe(250)
  expect(effective.adapter!.vcfGzLocation.uri).toBe('corrected.vcf.gz')
})

test('top-level scalar and value-array edits', () => {
  const edited = clone(base)
  edited.name = 'renamed'
  edited.category = ['Variants', 'Extra']

  const delta = diffTrackConfig(base, edited)
  expect(delta).toEqual({
    trackId: 'vcf',
    name: 'renamed',
    category: ['Variants', 'Extra'],
  })
  expect(mergeTrackConfig(base, delta)).toEqual(edited)
})

test('value arrays are replaced wholesale, not element-merged', () => {
  const b: Cfg = {
    trackId: 't',
    displays: [],
    jexlFilters: ['jexl:a', 'jexl:b'],
  }
  const e: Cfg = { trackId: 't', displays: [], jexlFilters: ['jexl:c'] }
  const delta = diffTrackConfig(b, e)
  expect(delta).toEqual({ trackId: 't', jexlFilters: ['jexl:c'] })
  expect(asCfg(mergeTrackConfig(b, delta)).jexlFilters).toEqual(['jexl:c'])
})

test('editing one display leaves sibling displays following the base', () => {
  const edited = clone(base)
  edited.displays[1]!.height = 99
  const delta = diffTrackConfig(base, edited)

  const newBase = clone(base)
  newBase.displays[0]!.renderer = 'ChordRendererV2'

  const merged = asCfg(mergeTrackConfig(newBase, delta))
  expect(merged.displays[0]!.renderer).toBe('ChordRendererV2')
  expect(merged.displays[1]!.height).toBe(99)
})

test('a legacy full override collapses to just trackId against an equal base', () => {
  expect(diffTrackConfig(base, clone(base))).toEqual({ trackId: 'vcf' })
})

test('a legacy full override that differs keeps only the differing fields', () => {
  const fullOverride = clone(base)
  fullOverride.displays[1]!.height = 300
  fullOverride.name = 'edited'
  expect(diffTrackConfig(base, fullOverride)).toEqual({
    trackId: 'vcf',
    name: 'edited',
    displays: [{ displayId: 'vcf-Linear', height: 300 }],
  })
})

test('a reset of an admin-set display slot is a null the merge removes', () => {
  const adminBase = clone(base)
  adminBase.displays[1]!.color = 'red'
  const userReset = clone(adminBase)
  delete userReset.displays[1]!.color

  const delta = diffTrackConfig(adminBase, userReset)
  expect(delta).toEqual({
    trackId: 'vcf',
    displays: [{ displayId: 'vcf-Linear', color: null }],
  })
  expect(mergeTrackConfig(adminBase, delta)).toEqual(userReset)
})

test('a reset of an admin-set top-level slot is a null the merge removes', () => {
  const userReset = clone(base)
  delete userReset.category

  const delta = diffTrackConfig(base, userReset)
  expect(delta).toEqual({ trackId: 'vcf', category: null })
  expect(mergeTrackConfig(base, delta)).toEqual(userReset)
})

function manhattan(y: Record<string, unknown>) {
  return {
    trackId: 'fst',
    displays: [
      {
        type: 'LinearManhattanDisplay',
        displayId: 'fst-LinearManhattanDisplay',
        scales: { y },
      },
    ],
  }
}
const manhattanBase = manhattan({ domainMax: 50, rules: [{ value: 0.295 }] })

// `stripDefault` drops an emptied list from the snapshot, so the edited side
// holds the list's absence
test('emptying an admin-filled list is a null on the list', () => {
  const emptied = manhattan({ domainMax: 50 })
  const delta = diffTrackConfig(manhattanBase, emptied)
  expect(delta).toEqual({
    trackId: 'fst',
    displays: [
      {
        displayId: 'fst-LinearManhattanDisplay',
        scales: { y: { rules: null } },
      },
    ],
  })
  expect(mergeTrackConfig(manhattanBase, delta)).toEqual(emptied)
})

// The edit left the whole namespace at its default, so `stripDefault` dropped
// `scales` itself; the reset is still of the one member the base set
test('a reset that empties a namespace nulls only what the base set there', () => {
  const rulesOnly = manhattan({ rules: [{ value: 0.295 }] })
  const emptied = {
    trackId: 'fst',
    displays: [
      {
        type: 'LinearManhattanDisplay',
        displayId: 'fst-LinearManhattanDisplay',
      },
    ],
  }
  const delta = diffTrackConfig(rulesOnly, emptied)
  expect(delta).toEqual({
    trackId: 'fst',
    displays: [
      {
        displayId: 'fst-LinearManhattanDisplay',
        scales: { y: { rules: null } },
      },
    ],
  })
  const laterBase = manhattan({ rules: [{ value: 0.295 }], domainMin: 5 })
  expect(mergeTrackConfig(laterBase, delta)).toEqual(
    manhattan({ domainMin: 5 }),
  )
})

test('a null survives the JSON a share link carries', () => {
  const emptied = manhattan({ domainMax: 50 })
  const shared = JSON.parse(
    JSON.stringify(diffTrackConfig(manhattanBase, emptied)),
  ) as Record<string, unknown>
  expect(mergeTrackConfig(manhattanBase, shared)).toEqual(emptied)
})

test('null and an absent member are the same thing to the diff', () => {
  expect(
    diffTrackConfig({ trackId: 't', color: null }, { trackId: 't' }),
  ).toEqual({ trackId: 't' })
  expect(
    diffTrackConfig({ trackId: 't' }, { trackId: 't', color: null }),
  ).toEqual({ trackId: 't' })
})

// The admin can later drop what a user reset. The merge then has nothing to
// remove, and a null reaching `create` would fail the track's hydration.
test('a null over a member the base no longer has leaves no null behind', () => {
  const displays = [
    {
      displayId: 'fst-LinearManhattanDisplay',
      scales: { y: { domainMax: 20, rules: null } },
    },
    {
      type: 'LinearMarkDisplay',
      displayId: 'fst-LinearMarkDisplay',
      minWidthPx: null,
      height: 80,
    },
  ]
  const arc = {
    type: 'LinearMarkDisplay',
    displayId: 'fst-LinearMarkDisplay',
    height: 80,
  }
  expect(
    mergeTrackConfig(
      {
        trackId: 'fst',
        displays: [
          {
            type: 'LinearManhattanDisplay',
            displayId: 'fst-LinearManhattanDisplay',
          },
        ],
      },
      { trackId: 'fst', category: null, displays },
    ),
  ).toEqual({
    trackId: 'fst',
    displays: [
      {
        type: 'LinearManhattanDisplay',
        displayId: 'fst-LinearManhattanDisplay',
        scales: { y: { domainMax: 20 } },
      },
      arc,
    ],
  })
  expect(
    mergeTrackConfig({ trackId: 'fst' }, { trackId: 'fst', displays }),
  ).toEqual({
    trackId: 'fst',
    displays: [
      {
        displayId: 'fst-LinearManhattanDisplay',
        scales: { y: { domainMax: 20 } },
      },
      arc,
    ],
  })
})

test('a display added only by the user is carried whole into the delta', () => {
  const edited = clone(base)
  edited.displays.push({ type: 'LDDisplay', displayId: 'vcf-LD', foo: 1 })
  const delta = diffTrackConfig(base, edited)
  expect(delta.displays).toEqual([
    { type: 'LDDisplay', displayId: 'vcf-LD', foo: 1 },
  ])
  expect((mergeTrackConfig(base, delta).displays as unknown[]).length).toBe(3)
})

test('flatten lists a top-level scalar change as from/to', () => {
  const edited = clone(base)
  edited.name = 'renamed'
  const delta = diffTrackConfig(base, edited)
  expect(flattenTrackConfigDelta(base, delta)).toEqual([
    { path: ['name'], from: 'my vcf', to: 'renamed' },
  ])
})

test('flatten addresses a display edit by display type and omits identity keys', () => {
  const edited = clone(base)
  edited.displays[1]!.color = 'green'
  const delta = diffTrackConfig(base, edited)
  expect(flattenTrackConfigDelta(base, delta)).toEqual([
    {
      path: ['displays', 'LinearVariantDisplay', 'color'],
      from: undefined,
      to: 'green',
    },
  ])
})

test('flatten lists a reset as a change to the default', () => {
  const adminBase = clone(base)
  adminBase.displays[1]!.color = 'red'
  const userReset = clone(adminBase)
  delete userReset.displays[1]!.color
  expect(
    flattenTrackConfigDelta(adminBase, diffTrackConfig(adminBase, userReset)),
  ).toEqual([
    {
      path: ['displays', 'LinearVariantDisplay', 'color'],
      from: 'red',
      to: undefined,
    },
  ])
})

test('flatten recurses nested config objects', () => {
  const edited = clone(base)
  edited.adapter!.vcfGzLocation.uri = 'new.vcf.gz'
  const delta = diffTrackConfig(base, edited)
  expect(flattenTrackConfigDelta(base, delta)).toEqual([
    {
      path: ['adapter', 'vcfGzLocation', 'uri'],
      from: 'v.vcf.gz',
      to: 'new.vcf.gz',
    },
  ])
})

test('flatten reports only real slots of a user-added display, not its stub', () => {
  const edited = clone(base)
  edited.displays.push({ type: 'LDDisplay', displayId: 'vcf-LD', foo: 1 })
  const delta = diffTrackConfig(base, edited)
  expect(flattenTrackConfigDelta(base, delta)).toEqual([
    { path: ['displays', 'LDDisplay', 'foo'], from: undefined, to: 1 },
  ])
})

test('flatten ignores content-free display stubs (only type/displayId)', () => {
  // a base track that omits displays; the edited snapshot gains stub displays
  // plus one real height edit (mirrors baseTrackConfig display injection)
  const noDisplayBase = { trackId: 't', type: 'FeatureTrack' }
  const delta = {
    trackId: 't',
    displays: [
      { type: 'LinearBasicDisplay', displayId: 't-basic', height: 200 },
      { type: 'LinearMarkDisplay', displayId: 't-marks' },
    ],
  }
  expect(flattenTrackConfigDelta(noDisplayBase, delta)).toEqual([
    {
      path: ['displays', 'LinearBasicDisplay', 'height'],
      from: undefined,
      to: 200,
    },
  ])
})

// `type` is identity on a display element and a real edit anywhere else. Skipping
// it by bare key name at every depth hid an adapter/renderer swap from the edited
// badge, from the Reset menu, and from the desktop web export's ship gate — which
// is this same list, so such an edit reached the recipient not at all.
test('flatten reports a nested type change but not a display stub type', () => {
  const noDisplayBase = {
    trackId: 't',
    type: 'FeatureTrack',
    adapter: { type: 'BamAdapter' },
  }
  const delta = {
    trackId: 't',
    adapter: { type: 'CramAdapter' },
    displays: [{ type: 'LinearBasicDisplay', displayId: 't-basic' }],
  }
  expect(flattenTrackConfigDelta(noDisplayBase, delta)).toEqual([
    { path: ['adapter', 'type'], from: 'BamAdapter', to: 'CramAdapter' },
  ])
})

test('flatten reports a renderer type swap inside a display', () => {
  const trackBase = {
    trackId: 't',
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: 't-basic',
        renderer: { type: 'SvgFeatureRenderer' },
      },
    ],
  }
  const delta = diffTrackConfig(trackBase, {
    trackId: 't',
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: 't-basic',
        renderer: { type: 'PileupRenderer' },
      },
    ],
  })
  expect(flattenTrackConfigDelta(trackBase, delta)).toEqual([
    {
      path: ['displays', 'LinearBasicDisplay', 'renderer', 'type'],
      from: 'SvgFeatureRenderer',
      to: 'PileupRenderer',
    },
  ])
})
