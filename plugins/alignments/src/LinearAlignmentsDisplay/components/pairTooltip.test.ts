import { formatChainTooltip, formatFeatureLabel } from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Single-read payload for the chain/pileup hover tooltip. The pair-anomaly rows
// read flags / insert size / orientation / mate ref + insertSizeStats.
function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    readNames: ['readA'],
    readPositions: new Uint32Array([1000, 1100]),
    readFlags: new Uint16Array([1]), // paired
    readInsertSizes: new Float32Array([500]),
    readPairOrientations: new Uint8Array([1]), // LR
    readNextRefs: ['chr1'],
    insertSizeStats: { upper: 1000, lower: 200, avg: 600, sd: 100 },
    ...overrides,
  } as PileupDataResult
}

describe('formatChainTooltip pair anomalies', () => {
  it('reports BOTH orientation and insert size when both are abnormal', () => {
    const tip = formatChainTooltip(
      makeRpcData({
        readPairOrientations: new Uint8Array([2]), // RL
        readInsertSizes: new Float32Array([5000]), // > upper
      }),
      0,
      'chr1',
    )
    expect(tip).toContain('Outward facing pair')
    expect(tip).toContain('Long insert size')
  })

  it('reports both for an abnormal-orientation short-insert pair', () => {
    const tip = formatChainTooltip(
      makeRpcData({
        readPairOrientations: new Uint8Array([3]), // RR
        readInsertSizes: new Float32Array([50]), // < lower
      }),
      0,
      'chr1',
    )
    expect(tip).toContain('Both mates reverse strand')
    expect(tip).toContain('Short insert size')
  })

  it('normal LR pair with a long insert shows only the insert row', () => {
    const tip = formatChainTooltip(
      makeRpcData({ readInsertSizes: new Float32Array([5000]) }),
      0,
      'chr1',
    )
    expect(tip).toContain('Long insert size')
    expect(tip).not.toContain('Abnormal orientation')
    expect(tip).not.toContain('facing pair')
  })

  it('unmapped mate pre-empts insert/orientation anomalies', () => {
    const tip = formatChainTooltip(
      makeRpcData({
        readFlags: new Uint16Array([1 | 8]), // paired + mate unmapped
        readPairOrientations: new Uint8Array([2]),
        readInsertSizes: new Float32Array([5000]),
      }),
      0,
      'chr1',
    )
    expect(tip).toContain('Unmapped mate')
    expect(tip).not.toContain('Long insert size')
    expect(tip).not.toContain('facing pair')
  })

  it('inter-chromosomal mate pre-empts insert/orientation anomalies', () => {
    const tip = formatChainTooltip(
      makeRpcData({
        readNextRefs: ['chr2'],
        readPairOrientations: new Uint8Array([2]),
        readInsertSizes: new Float32Array([5000]),
      }),
      0,
      'chr1',
    )
    expect(tip).toContain('Inter-chromosomal (mate on chr2)')
    expect(tip).not.toContain('Long insert size')
    expect(tip).not.toContain('facing pair')
  })
})

describe('read tooltip location', () => {
  // readPositions are 0-based half-open, so the hover must render start + 1 to
  // agree with the context menu's "Copy location", the feature detail widget,
  // and the SNP tooltip on the same read.
  it('renders the read start 1-based', () => {
    expect(formatChainTooltip(makeRpcData(), 0, 'chr1')).toContain(
      'chr1:1,001-1,100',
    )
  })

  it('formats a feature label 1-based, with the strand only when asked', () => {
    const info = {
      id: 'f1',
      name: 'readA',
      start: 1000,
      end: 1100,
      strand: -1,
      refName: 'chr1',
    }
    expect(formatFeatureLabel(info, { showStrand: true })).toBe(
      'readA chr1:1,001-1,100 (-)',
    )
    expect(formatFeatureLabel(info)).toBe('readA chr1:1,001-1,100')
  })

  it('falls back to the feature id when the read has no name', () => {
    expect(
      formatFeatureLabel({
        id: 'f1',
        name: '',
        start: 0,
        end: 100,
        strand: 1,
        refName: 'chr1',
      }),
    ).toBe('f1 chr1:1-100')
  })
})
