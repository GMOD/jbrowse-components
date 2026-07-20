import { buildGwasTrackConfig, canSubmit } from './util.ts'

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
const noIndexes = {
  gwasIndexLocation: undefined,
  ldLocation: undefined,
  ldIndexLocation: undefined,
}

test('canSubmit requires a GWAS file, a name, and an assembly', () => {
  const g = uri('a.bed.gz')
  expect(
    canSubmit({
      gwasLocation: g,
      trackName: 'x',
      assembly: 'hg38',
      ...noIndexes,
    }),
  ).toBe(true)
  expect(
    canSubmit({
      gwasLocation: undefined,
      trackName: 'x',
      assembly: 'hg38',
      ...noIndexes,
    }),
  ).toBe(false)
  expect(
    canSubmit({
      gwasLocation: g,
      trackName: '  ',
      assembly: 'hg38',
      ...noIndexes,
    }),
  ).toBe(false)
  expect(
    canSubmit({
      gwasLocation: g,
      trackName: 'x',
      assembly: undefined,
      ...noIndexes,
    }),
  ).toBe(false)
})

test('canSubmit: an uploaded GWAS file with no derivable .tbi requires an index', () => {
  const base = { trackName: 'x', assembly: 'hg38' as const }
  // URL and local path both derive their .tbi, so no explicit index is needed
  expect(
    canSubmit({ ...base, ...noIndexes, gwasLocation: uri('a.bed.gz') }),
  ).toBe(true)
  expect(
    canSubmit({ ...base, ...noIndexes, gwasLocation: local('/a.bed.gz') }),
  ).toBe(true)
  // a blob upload has no derivable sibling index
  expect(
    canSubmit({ ...base, ...noIndexes, gwasLocation: blob('a.bed.gz') }),
  ).toBe(false)
  expect(
    canSubmit({
      ...base,
      ...noIndexes,
      gwasLocation: blob('a.bed.gz'),
      gwasIndexLocation: blob('a.bed.gz.tbi'),
    }),
  ).toBe(true)
})

test('canSubmit: an uploaded LD file needs an index only when it is tabix (.gz)', () => {
  const base = {
    trackName: 'x',
    assembly: 'hg38' as const,
    gwasLocation: uri('a.bed.gz'),
    gwasIndexLocation: undefined,
    ldIndexLocation: undefined,
  }
  // blob tabix LD without an index blocks submit
  expect(canSubmit({ ...base, ldLocation: blob('p.ld.gz') })).toBe(false)
  expect(
    canSubmit({
      ...base,
      ldLocation: blob('p.ld.gz'),
      ldIndexLocation: blob('p.ld.gz.tbi'),
    }),
  ).toBe(true)
  // a plain (non-tabix) blob .ld carries no index at all
  expect(canSubmit({ ...base, ldLocation: blob('p.ld') })).toBe(true)
  // a local-path tabix LD derives its .tbi
  expect(canSubmit({ ...base, ldLocation: local('/p.ld.gz') })).toBe(true)
})

test('without LD: default score column/transform omitted, no displays, derives .tbi', () => {
  const cfg = buildGwasTrackConfig({
    trackId: 't1',
    trackName: 'GWAS',
    assembly: 'hg38',
    gwasLocation: uri('http://host/g.bed.gz'),
    gwasIndexLocation: undefined,
    scoreColumn: 'neg_log_pvalue',
    scoreTransform: 'none',
    ldLocation: undefined,
    ldIndexLocation: undefined,
  })
  // both score fields are at their schema defaults, so neither is written
  expect(cfg.adapter).toEqual({
    type: 'GWASAdapter',
    bedGzLocation: uri('http://host/g.bed.gz'),
    index: { indexType: 'TBI', location: uri('http://host/g.bed.gz.tbi') },
  })
  expect('displays' in cfg).toBe(false)
})

test('a supplied .csi GWAS index is typed CSI, not assumed TBI', () => {
  const cfg = buildGwasTrackConfig({
    trackId: 't1',
    trackName: 'GWAS',
    assembly: 'hg38',
    gwasLocation: uri('http://host/g.bed.gz'),
    gwasIndexLocation: uri('http://host/g.bed.gz.csi'),
    scoreColumn: 'neg_log_pvalue',
    scoreTransform: 'none',
    ldLocation: undefined,
    ldIndexLocation: undefined,
  })
  expect(cfg.adapter).toMatchObject({
    index: { indexType: 'CSI', location: uri('http://host/g.bed.gz.csi') },
  })
})

test('a raw p-value column bakes scoreTransform into the adapter', () => {
  const cfg = buildGwasTrackConfig({
    trackId: 't1',
    trackName: 'GWAS',
    assembly: 'hg38',
    gwasLocation: uri('http://host/g.bed.gz'),
    gwasIndexLocation: undefined,
    scoreColumn: 'pvalue',
    scoreTransform: 'negLog10',
    ldLocation: undefined,
    ldIndexLocation: undefined,
  })
  expect(cfg.adapter).toEqual({
    type: 'GWASAdapter',
    bedGzLocation: uri('http://host/g.bed.gz'),
    index: { indexType: 'TBI', location: uri('http://host/g.bed.gz.tbi') },
    scoreColumn: 'pvalue',
    scoreTransform: 'negLog10',
  })
})

test('with LD: adds a LinearManhattanDisplay in ld color mode', () => {
  const cfg = buildGwasTrackConfig({
    trackId: 't1',
    trackName: 'GWAS',
    assembly: 'hg38',
    gwasLocation: uri('http://host/g.bed.gz'),
    gwasIndexLocation: uri('http://host/g.bed.gz.tbi'),
    scoreColumn: 'pvalue',
    scoreTransform: 'none',
    ldLocation: uri('http://host/p.ld.gz'),
    ldIndexLocation: undefined,
  })
  expect(cfg.adapter).toMatchObject({
    type: 'GWASAdapter',
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: 'http://host/p.ld.gz',
    },
  })
  expect(cfg.displays).toEqual([
    {
      type: 'LinearManhattanDisplay',
      colorBy: 'ld',
    },
  ])
})
