import { formats } from '../../../../packages/add-track-core/src/formats.ts'
import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { fileKind, lookupTrack, ownDisplayConfig } from './configs.ts'

test('every format add-track opens names the file a reader needs', () => {
  const unnamed = formats
    .flatMap(({ spec }) => (spec.kind === 'unsupported' ? [] : [spec]))
    .map(spec => spec.adapterType)
    .filter(type => type !== 'SPARQLAdapter' && !fileKind(type))
  expect([...new Set(unnamed)]).toEqual([])
})

test('an adapter that reads a BED per genome says so', () => {
  const pairs = Object.entries(configManifest.adapters)
    .filter(([, { slots }]) => slots.some(slot => slot.name === 'bed1Location'))
    .map(([type]) => type)
  expect(pairs).toContain('MCScanAnchorsAdapter')
  expect(pairs.filter(type => !fileKind(type)?.includes('one BED per genome'))).toEqual([])
})

test('a shorthand session track gets its track and adapter types from its file', () => {
  expect(
    lookupTrack('test_data/volvox/config.json', 'calls', [
      { trackId: 'calls', uri: 'https://example.com/calls.vcf.gz' },
    ]),
  ).toMatchObject({ type: 'VariantTrack', adapterType: 'VcfTabixAdapter' })
})

test('a bare display entry the track opens as anyway is no display config', () => {
  const genes = lookupTrack('test_data/volvox/config.json', 'gff3tabix_genes')
  const styled = { type: 'LinearBasicDisplay', height: 90 }
  const ownOf = (displays: { type: string }[]) =>
    ownDisplayConfig({ trackId: 't', displays }, genes, 'LinearGenomeView')
  expect(ownOf([{ type: 'LinearBasicDisplay' }])).toEqual({})
  const multiRow = [{ type: 'LinearMultiRowFeatureDisplay' }, styled]
  expect(ownOf(multiRow)).toEqual({ displays: multiRow })
})
