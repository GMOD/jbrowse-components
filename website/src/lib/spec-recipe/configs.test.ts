import { formats } from '../../../../packages/add-track-core/src/formats.ts'
import { fileKind, lookupTrack } from './configs.ts'

test('every format add-track opens names the file a reader needs', () => {
  const unnamed = formats
    .flatMap(({ spec }) => (spec.kind === 'unsupported' ? [] : [spec]))
    .map(spec => spec.adapterType)
    .filter(type => type !== 'SPARQLAdapter' && !fileKind(type))
  expect([...new Set(unnamed)]).toEqual([])
})

test('a shorthand session track gets its track and adapter types from its file', () => {
  expect(
    lookupTrack('test_data/volvox/config.json', 'calls', [
      { trackId: 'calls', uri: 'https://example.com/calls.vcf.gz' },
    ]),
  ).toMatchObject({ type: 'VariantTrack', adapterType: 'VcfTabixAdapter' })
})
