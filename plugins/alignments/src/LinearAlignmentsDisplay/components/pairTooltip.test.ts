import { namesToBlock } from '../../shared/readNameBlock.ts'
import { formatChainTooltip, formatFeatureLabel } from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Single-read payload for the chain/pileup hover tooltip. The pair-anomaly rows
// read flags / insert size / orientation / readInterchrom + insertSizeStats.
// `readNextRefs` only names the mate in the message; whether the mate is on
// another chromosome is the worker's `readInterchrom` verdict.
function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    ...namesToBlock(['readA']),
    readPositions: new Uint32Array([1000, 1100]),
    readFlags: new Uint16Array([1]), // paired
    readInsertSizes: new Float32Array([500]),
    readPairOrientations: new Uint8Array([1]), // LR
    readNextRefs: ['chr1'],
    readInterchrom: new Uint8Array([0]),
    insertSizeStats: { upper: 1000, lower: 200 },
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
        readInterchrom: new Uint8Array([1]),
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

  // RNEXT carries the BAM header's own naming while the refName handed to the
  // tooltip is assembly-canonical, so on an aliased BAM (file `chr1`, assembly
  // `1`) a same-chromosome mate has readNextRefs !== refName. Comparing the two
  // here called every paired read inter-chromosomal and, being pre-emptive,
  // swallowed its real anomaly rows. The worker's readInterchrom flag — computed
  // with both names in file space, and what the read fill already uses — is the
  // only thing that decides this.
  it('does not call an aliased same-chromosome mate inter-chromosomal', () => {
    const tip = formatChainTooltip(
      makeRpcData({
        readNextRefs: ['chr1'], // file naming
        readInterchrom: new Uint8Array([0]), // worker: same chromosome
        readPairOrientations: new Uint8Array([2]),
        readInsertSizes: new Float32Array([5000]),
      }),
      0,
      '1', // assembly-canonical naming
    )
    expect(tip).not.toContain('Inter-chromosomal')
    expect(tip).toContain('Outward facing pair')
    expect(tip).toContain('Long insert size')
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

  // `hitTestChain` answers with the chain's FIRST read, so reading the location
  // off that read described mate 1 under a heading naming the whole template.
  // The connecting line between mates is a deliberate hover target — more so
  // now that chain mode draws one across displayed regions.
  it('spans the whole chain, not the read the hit test happened to name', () => {
    const tip = formatChainTooltip(
      makeRpcData({
        readChainIndices: new Uint32Array([0]),
        chainAbsMinStarts: new Uint32Array([1000]),
        chainAbsMaxEnds: new Uint32Array([4200]),
      }),
      0,
      'chr1',
    )
    expect(tip).toContain('chr1:1,001-4,200')
  })

  // A hover on an ordinary read carries no chain arrays; the read's own span is
  // the right answer there and must still be what it reports.
  it('falls back to the read span with no chain metadata', () => {
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
