import { diffTrackConfig, mergeTrackConfig } from './trackConfigDelta.ts'

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

test('no-tombstone limitation: resetting an admin-set slot is not expressed', () => {
  const adminBase = clone(base)
  adminBase.displays[1]!.color = 'red'

  const userReset = clone(adminBase)
  delete userReset.displays[1]!.color

  const delta = diffTrackConfig(adminBase, userReset)
  expect(delta).toEqual({ trackId: 'vcf' })
  expect(asCfg(mergeTrackConfig(adminBase, delta)).displays[1]!.color).toBe(
    'red',
  )
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
