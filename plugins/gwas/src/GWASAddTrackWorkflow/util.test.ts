import { buildGwasTrackConfig, canSubmit } from './util.ts'

const uri = (s: string) => ({ uri: s, locationType: 'UriLocation' as const })

test('canSubmit requires a GWAS file, a name, and an assembly', () => {
  const ld = uri('a.bed.gz')
  expect(
    canSubmit({ gwasLocation: ld, trackName: 'x', assembly: 'hg38' }),
  ).toBe(true)
  expect(
    canSubmit({ gwasLocation: undefined, trackName: 'x', assembly: 'hg38' }),
  ).toBe(false)
  expect(
    canSubmit({ gwasLocation: ld, trackName: '  ', assembly: 'hg38' }),
  ).toBe(false)
  expect(
    canSubmit({ gwasLocation: ld, trackName: 'x', assembly: undefined }),
  ).toBe(false)
})

test('without LD: GWAS adapter only, no displays override, derives .tbi', () => {
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
    displayId: 'd1',
  })
  expect(cfg.adapter).toEqual({
    type: 'GWASAdapter',
    bedGzLocation: uri('http://host/g.bed.gz'),
    index: { indexType: 'TBI', location: uri('http://host/g.bed.gz.tbi') },
    scoreColumn: 'neg_log_pvalue',
  })
  expect('displays' in cfg).toBe(false)
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
    displayId: 'd1',
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
    displayId: 'd1',
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
      displayId: 'd1',
      colorBy: 'ld',
    },
  ])
})
