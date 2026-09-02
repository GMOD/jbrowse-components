import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { indelMagnitude } from './components/MultiRowTooltip.tsx'
import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// A pangenome path track: each block is one strain's allele over a bubble, and
// the block's WIDTH is reference span — a 35bp insertion into a 1bp bubble and a
// reference-length allele draw the same box. The indel glyphs are what carries
// the magnitude on the canvas, and the tooltip is the only place a reader can
// get the number when the block is too small to hold a label.
function region(deltas: number[]): MultiRowRegionData {
  return {
    featureStarts: Uint32Array.from(deltas, (_, i) => 100 + i * 200),
    featureEnds: Uint32Array.from(deltas, (_, i) => 200 + i * 200),
    featureColors: Uint32Array.from(deltas, () => cssColorToABGR('red')),
    featureDeltas: Int32Array.from(deltas),
    partitionValues: ['strainA'],
    featurePartitionIndex: Uint32Array.from(deltas, () => 0),
    featureNames: deltas.map(() => 'bubble'),
    featureIds: deltas.map((_, i) => `f${i}`),
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

const CTGA_1KB = [
  { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
]

function displayWith(data: MultiRowRegionData) {
  const { display } = createTestEnvironment({
    displayConfig: { lengthField: 'length_delta' },
  }).createDisplay(CTGA_1KB)
  display.setRpcData(0, data)
  return display
}

describe('the hit carries the length change the block cannot show', () => {
  it('carries a signed delta off the packed arrays', () => {
    const display = displayWith(region([35, -12, 0]))

    expect(display.featureAt(150, 10)?.delta).toBe(35)
    expect(display.featureAt(350, 10)?.delta).toBe(-12)
    expect(display.featureAt(550, 10)?.delta).toBe(0)
  })

  // `featureDeltas` is EMPTY rather than zero-filled where the `lengthField`
  // slot is unset, which is the same length agreement the glyph pass makes
  // before it indexes into it.
  it('carries nothing where the slot packed no deltas', () => {
    const display = displayWith({
      ...region([35]),
      featureDeltas: new Int32Array(0),
    })

    expect(display.featureAt(150, 10)?.delta).toBeUndefined()
  })
})

describe('indelMagnitude', () => {
  it('signs both directions and groups the digits', () => {
    expect(indelMagnitude(35)).toBe('+35 bp')
    expect(indelMagnitude(-12)).toBe('-12 bp')
    expect(indelMagnitude(9048)).toBe('+9,048 bp')
  })

  // the two cases the glyph pass draws nothing for
  it('says nothing where there is no length change to state', () => {
    expect(indelMagnitude(0)).toBeUndefined()
    expect(indelMagnitude(undefined)).toBeUndefined()
  })
})
