import { LD_MARKS } from '../LinearManhattanDisplay/ldPlot.ts'
import { INITIAL_GWAS_FORM, gwasTrackMixin } from './gwasTrackMixin.ts'

const uri = (s: string) => ({ uri: s, locationType: 'UriLocation' as const })
const local = (s: string) => ({
  localPath: s,
  locationType: 'LocalPathLocation' as const,
})
const blob = (name: string) => ({
  blobId: 'b1',
  name,
  locationType: 'BlobLocation' as const,
})

test('the score fields at their defaults add nothing', () => {
  expect(gwasTrackMixin(INITIAL_GWAS_FORM)).toEqual({ adapter: {} })
})

test('a raw p-value column writes its column and transform', () => {
  expect(
    gwasTrackMixin({
      ...INITIAL_GWAS_FORM,
      scoreColumn: 'pvalue',
      scoreTransform: 'negLog10',
    }),
  ).toEqual({ adapter: { scoreColumn: 'pvalue', scoreTransform: 'negLog10' } })
})

test('an LD file adds its sub-adapter and the plot colored by r² to the index SNP', () => {
  expect(
    gwasTrackMixin({
      ...INITIAL_GWAS_FORM,
      ldLocation: uri('http://host/p.ld.gz'),
    }),
  ).toEqual({
    adapter: {
      ldAdapter: {
        type: 'PlinkLDTabixAdapter',
        ldLocation: uri('http://host/p.ld.gz'),
        index: {
          indexType: 'TBI',
          location: uri('http://host/p.ld.gz.tbi'),
        },
      },
    },
    displayDefaults: { marks: LD_MARKS },
  })
})

test('an uploaded bgzipped LD file adds nothing until its index is given', () => {
  const ldLocation = blob('p.ld.gz')
  expect(gwasTrackMixin({ ...INITIAL_GWAS_FORM, ldLocation })).toEqual({
    adapter: {},
  })
  expect(
    gwasTrackMixin({
      ...INITIAL_GWAS_FORM,
      ldLocation,
      ldIndexLocation: blob('p.ld.gz.tbi'),
    }).adapter,
  ).toMatchObject({ ldAdapter: { type: 'PlinkLDTabixAdapter' } })
})

test('an LD file with no index to find needs none when it is plain text or a local path', () => {
  expect(
    gwasTrackMixin({ ...INITIAL_GWAS_FORM, ldLocation: blob('p.ld') }).adapter,
  ).toMatchObject({ ldAdapter: { type: 'PlinkLDAdapter' } })
  expect(
    gwasTrackMixin({ ...INITIAL_GWAS_FORM, ldLocation: local('/p.ld.gz') })
      .adapter,
  ).toMatchObject({ ldAdapter: { type: 'PlinkLDTabixAdapter' } })
})
