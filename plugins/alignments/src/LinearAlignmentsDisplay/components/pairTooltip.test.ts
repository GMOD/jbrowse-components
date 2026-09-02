import {
  readCategoryLabelOverrides,
  readColorCategoryLabel,
} from '../../shared/legendUtils.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import { nextRefsToTable } from '../../shared/readNextRefs.ts'
import { READ_COLOR_CATEGORY } from '../colorUtils.ts'
import { formatReadTooltip, formatFeatureLabel } from './tooltipUtils.ts'

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
    readMapqs: new Uint8Array([60]),
    readStrands: Int8Array.from([1]),
    readInsertSizes: new Float32Array([500]),
    readPairOrientations: new Uint8Array([1]), // LR
    ...nextRefsToTable(['chr1']),
    readInterchrom: new Uint8Array([0]),
    // An ordinary unbucketed read, which is what the color row must stay silent
    // about. Present rather than omitted because the field is REQUIRED on
    // `PileupDataResult` and the `as` cast below is what let it be missing — the
    // hazard `makePileupDataResult` exists to close.
    readColorCategories: Uint8Array.from([READ_COLOR_CATEGORY.plain]),
    insertSizeStats: { upper: 1000, lower: 200 },
    ...overrides,
  } as PileupDataResult
}

describe('formatReadTooltip pair anomalies', () => {
  it('reports BOTH orientation and insert size when both are abnormal', () => {
    const tip = formatReadTooltip(
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
    const tip = formatReadTooltip(
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
    const tip = formatReadTooltip(
      makeRpcData({ readInsertSizes: new Float32Array([5000]) }),
      0,
      'chr1',
    )
    expect(tip).toContain('Long insert size')
    expect(tip).not.toContain('Abnormal orientation')
    expect(tip).not.toContain('facing pair')
  })

  it('unmapped mate pre-empts insert/orientation anomalies', () => {
    const tip = formatReadTooltip(
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
    const tip = formatReadTooltip(
      makeRpcData({
        ...nextRefsToTable(['chr2']),
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
    const tip = formatReadTooltip(
      makeRpcData({
        ...nextRefsToTable(['chr1']), // file naming
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
    expect(formatReadTooltip(makeRpcData(), 0, 'chr1')).toContain(
      'chr1:1,001-1,100',
    )
  })

  // `hitTestChain` answers with the chain's FIRST read, so reading the location
  // off that read described mate 1 under a heading naming the whole template.
  // The connecting line between mates is a deliberate hover target — more so
  // now that chain mode draws one across displayed regions.
  it('spans the whole chain, not the read the hit test happened to name', () => {
    const tip = formatReadTooltip(
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
    expect(formatReadTooltip(makeRpcData(), 0, 'chr1')).toContain(
      'chr1:1,001-1,100',
    )
  })

  // The strand used to be the plain-pileup hover's alone, from a separate
  // formatter reading `getFeatureInfoById`. It is the same normalized
  // `readStrands` either way — a PAF/synteny block has one and no flags — and
  // chain mode dropped it entirely.
  it('prints the strand on the location line', () => {
    expect(
      formatReadTooltip(
        makeRpcData({ readStrands: Int8Array.from([-1]) }),
        0,
        'chr1',
      ),
    ).toContain('chr1:1,001-1,100 (-)')
    expect(formatReadTooltip(makeRpcData(), 0, 'chr1')).toContain(
      'chr1:1,001-1,100 (+)',
    )
  })

  // 0 is a real, and the most interesting, mapping quality — a multi-mapping
  // read — so the row is written from the value and not from its truthiness.
  it('reports the mapping quality', () => {
    expect(formatReadTooltip(makeRpcData(), 0, 'chr1')).toContain('MAPQ: 60')
    expect(
      formatReadTooltip(
        makeRpcData({ readMapqs: new Uint8Array([0]) }),
        0,
        'chr1',
      ),
    ).toContain('MAPQ: 0')
  })

  // 255 is the spec's "not available" sentinel, named the same way the legend
  // and the MAPQ group-by name it.
  it('names an unavailable mapping quality rather than reporting 255', () => {
    const tip = formatReadTooltip(
      makeRpcData({ readMapqs: new Uint8Array([255]) }),
      0,
      'chr1',
    )
    expect(tip).toContain('MAPQ unavailable')
    expect(tip).not.toContain('255')
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

// Chain mode is the only mode where the fill cannot be derived from the read's
// own record — `consensusChainStrandFrames` settles it from the other chains on
// screen — so this row is what connects the color to the legend entry that
// explains it.
describe('formatReadTooltip names the color bucket', () => {
  const framed = makeRpcData({
    readStrands: Int8Array.from([-1]),
    readColorCategories: Uint8Array.from([READ_COLOR_CATEGORY.fwdStrand]),
  })

  it('reports the wording the legend uses, not the raw table', () => {
    const tip = formatReadTooltip(framed, 0, 'chr1', c =>
      readColorCategoryLabel(c, readCategoryLabelOverrides(undefined, true)),
    )
    // the confusing pair, and the reason the row exists: a reverse-MAPPED
    // segment painted "same strand", because "same" is against the chain's
    // frame. Without the overrides this would read "Forward strand" over a
    // read whose own strand is minus.
    expect(tip).toContain('Split segment (same strand)')
    expect(tip).not.toContain('Forward strand')
  })

  it('says nothing when no label resolver is supplied', () => {
    expect(formatReadTooltip(framed, 0, 'chr1')).not.toContain('Color:')
  })

  // `readColorCategories` ships EMPTY from the worker and is baked on the main
  // thread, so a hover can beat the bake. Every other row of this tooltip is
  // readable then, and this one has to be absent rather than "Color: undefined".
  it('says nothing before the categories are baked', () => {
    const tip = formatReadTooltip(
      makeRpcData({ readColorCategories: new Uint8Array(0) }),
      0,
      'chr1',
      readColorCategoryLabel,
    )
    expect(tip).not.toContain('Color:')
    expect(tip).toContain('chr1:1,001-1,100')
  })

  it('omits the row for a bucket with no single name', () => {
    // the mapq/tag/modification ramps have no one swatch, so `undefined` must
    // append nothing rather than an empty row
    const tip = formatReadTooltip(
      makeRpcData({
        readColorCategories: Uint8Array.from([READ_COLOR_CATEGORY.mapq]),
      }),
      0,
      'chr1',
      readColorCategoryLabel,
    )
    expect(tip).not.toContain('Color:')
  })
})
