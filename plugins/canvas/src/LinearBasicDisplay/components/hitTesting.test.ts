import { LABEL_FONT_SIZE } from '../../RenderFeatureDataRPC/constants.ts'
import {
  makeAminoAcidOverlayItem,
  makeFeatureData,
  makeFlatbushItem,
  makeSubfeatureInfo,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
  isHitFeature,
  performMultiRegionHitDetection,
  regionBpPerPx,
} from './hitTesting.ts'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  FlatbushRegionIndexes,
  LabelVisibility,
  VisibleRegion,
} from './hitTesting.ts'

function makeItem(
  featureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
): FlatbushItem {
  return makeFlatbushItem({
    featureId,
    startBp,
    endBp,
    topPx,
    bottomPx,
    featureHeightPx: bottomPx - topPx,
  })
}

function makeSub(
  featureId: string,
  parentFeatureId: string,
  startBp: number,
  endBp: number,
  topPx: number,
  bottomPx: number,
): SubfeatureInfo {
  return makeSubfeatureInfo({
    featureId,
    parentFeatureId,
    startBp,
    endBp,
    topPx,
    bottomPx,
  })
}

function makeData(
  flatbushItems: FlatbushItem[],
  subfeatureInfos: SubfeatureInfo[] = [],
  aminoAcidOverlay?: AminoAcidOverlayItem[],
): FeatureDataResult {
  return makeFeatureData({ flatbushItems, subfeatureInfos, aminoAcidOverlay })
}

function makeRegion(
  displayedRegionIndex: number,
  start: number,
  end: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
): VisibleRegion {
  return {
    refName: 'ctgA',
    displayedRegionIndex,
    start,
    end,
    reversed,
    assemblyName: 'volvox',
    screenStartPx,
    screenEndPx,
  }
}

// Build the per-region Flatbush indexes the model would compute via its
// `flatbushIndexes` view, so tests can drive `performMultiRegionHitDetection`
// directly without booting an MST tree.
function buildIndexes(
  laidOutDataMap: Map<number, FeatureDataResult>,
  regions: VisibleRegion[],
  labels: LabelVisibility,
): Map<number, FlatbushRegionIndexes> {
  const out = new Map<number, FlatbushRegionIndexes>()
  for (const vr of regions) {
    const data = laidOutDataMap.get(vr.displayedRegionIndex)
    if (data) {
      out.set(vr.displayedRegionIndex, {
        feature: buildFeatureFlatbushIndex(
          data.flatbushItems,
          data.floatingLabelsData,
          regionBpPerPx(vr),
          vr.reversed ?? false,
          labels,
        ),
        subfeature: buildSubfeatureFlatbushIndex(data.subfeatureInfos),
      })
    }
  }
  return out
}

// Normal display mode: baked label widths are measured at LABEL_FONT_SIZE, so
// this is the identity case for the hit box's label-overhang scaling.
const DEFAULT_LABELS: LabelVisibility = {
  showLabels: true,
  showDescriptions: false,
  fontSize: LABEL_FONT_SIZE,
}

function hit(
  laidOutDataMap: Map<number, FeatureDataResult>,
  regions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
  labels: LabelVisibility = DEFAULT_LABELS,
) {
  const indexes = buildIndexes(laidOutDataMap, regions, labels)
  return performMultiRegionHitDetection(
    laidOutDataMap,
    indexes,
    regions,
    mouseXPx,
    yPos,
  )
}

test('hits feature at correct coordinates', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    320,
    10,
  )
  expect(result.feature).not.toBeNull()
  expect(result.feature!.featureId).toBe('gene1')
})

test('misses when clicking outside feature bounds', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    10,
    10,
  )
  expect(result.feature).toBeNull()
})

test('misses when clicking below feature', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    320,
    25,
  )
  expect(result.feature).toBeNull()
})

test('returns correct displayedRegionIndex', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(
    new Map([[7, data]]),
    [makeRegion(7, 0, 10000, 0, 800)],
    320,
    10,
  )
  expect(isHitFeature(result)).toBe(true)
  if (isHitFeature(result)) {
    expect(result.displayedRegionIndex).toBe(7)
  }
})

test('skips regions where mouseX is outside screen bounds', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const laidOutDataMap = new Map([[0, data]])
  const region = makeRegion(0, 0, 10000, 100, 500)

  expect(hit(laidOutDataMap, [region], 50, 10).feature).toBeNull()
  expect(hit(laidOutDataMap, [region], 250, 10).feature).not.toBeNull()
})

test('hits subfeature when within subfeature bounds', () => {
  const parent = makeItem('gene1', 1000, 5000, 0, 30)
  const sub = makeSub('mRNA1', 'gene1', 2000, 3000, 5, 15)
  const data = makeData([parent], [sub])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    200,
    10,
  )
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature!.featureId).toBe('mRNA1')
})

test('overlapping same-row subfeatures: topmost (last painted) wins', () => {
  // A repeat_region's internal body and an LTR share one row and overlap; the
  // body is registered/painted first (lower subfeatureInfos index), the LTR on
  // top. Flatbush returns both matches in arbitrary tree order, so the hit must
  // resolve to the LTR (largest index = last painted) rather than whichever the
  // index happens to yield first.
  const parent = makeItem('repeat1', 1000, 5000, 0, 20)
  const body = makeSub('body', 'repeat1', 1000, 5000, 0, 20)
  const ltr = makeSub('ltr', 'repeat1', 1000, 2000, 0, 20)
  const data = makeData([parent], [body, ltr])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    120, // ≈1500bp, inside both the body (1000-5000) and the LTR (1000-2000)
    10,
  )
  expect(result.subfeature!.featureId).toBe('ltr')
})

test('overlapping features: the hit feature keeps its own topmost subfeature', () => {
  // Collapsed display mode packs every feature onto row 0, so two genes'
  // transcripts share the same pixels. The feature index resolves to gene1
  // (last painted of the two), while the subfeature index's topmost match at
  // that point is gene2's transcript. gene1's own transcript is under the
  // cursor and must be the one reported — not dropped because a neighbour's
  // sat above it.
  const gene2 = makeItem('gene2', 1500, 6000, 0, 20)
  const gene1 = makeItem('gene1', 1000, 5000, 0, 20)
  const mrna1 = makeSub('mRNA1', 'gene1', 1000, 5000, 0, 20)
  const mrna2 = makeSub('mRNA2', 'gene2', 1500, 6000, 0, 20)
  const data = makeData([gene2, gene1], [mrna1, mrna2])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    160, // ≈2000bp, inside both genes and both transcripts
    10,
  )
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature!.featureId).toBe('mRNA1')
})

// The consumer half of the invariant `emitSubfeaturesGlyph` holds: a subfeature
// names the RECORD's id, however deep it sits. Named after the intermediate
// container it hangs off, the gate below drops it — and the symptom is the
// quietest kind, since it is drawn and labelled exactly as before and simply
// never resolves. No hover, no highlight scope, no subfeature rows on the
// right-click menu.
test('pairs a subfeature named after the record, at any nesting depth', () => {
  const record = makeItem('match1', 1000, 5000, 0, 20)
  const nested = makeSub('part1', 'match1', 2000, 3000, 0, 20)
  const result = hit(
    new Map([[0, makeData([record], [nested])]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    200, // ≈2500bp, inside both
    10,
  )
  expect(result.subfeature!.featureId).toBe('part1')
})

test('drops a subfeature naming a container instead of the record', () => {
  const record = makeItem('match1', 1000, 5000, 0, 20)
  // 'inner' is a container between the record and this part; the gate pairs on
  // the record's id alone, so this resolves to no subfeature at all
  const nested = makeSub('part1', 'inner', 2000, 3000, 0, 20)
  const result = hit(
    new Map([[0, makeData([record], [nested])]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    200,
    10,
  )
  expect(result.feature!.featureId).toBe('match1')
  expect(result.subfeature).toBeNull()
})

test('returns null subfeature when outside subfeature but inside feature', () => {
  const parent = makeItem('gene1', 1000, 5000, 0, 30)
  const sub = makeSub('mRNA1', 'gene1', 2000, 3000, 5, 15)
  const data = makeData([parent], [sub])
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    120,
    25,
  )
  expect(result.feature!.featureId).toBe('gene1')
  expect(result.subfeature).toBeNull()
})

test('returns no hit when laidOutDataMap is empty', () => {
  const result = hit(new Map(), [makeRegion(0, 0, 10000, 0, 800)], 400, 10)
  expect(result.feature).toBeNull()
})

test('returns no hit when no visible regions', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  const result = hit(new Map([[0, data]]), [], 400, 10)
  expect(result.feature).toBeNull()
})

test('multi-region selects correct region', () => {
  const data1 = makeData([makeItem('geneA', 100, 400, 0, 20)])
  const data2 = makeData([makeItem('geneB', 100, 400, 0, 20)])
  const laidOutDataMap = new Map([
    [0, data1],
    [1, data2],
  ])
  const regions = [
    makeRegion(0, 0, 1000, 0, 400),
    makeRegion(1, 0, 1000, 400, 800),
  ]

  const hitR0 = hit(laidOutDataMap, regions, 100, 10)
  expect(isHitFeature(hitR0)).toBe(true)
  if (isHitFeature(hitR0)) {
    expect(hitR0.feature.featureId).toBe('geneA')
    expect(hitR0.displayedRegionIndex).toBe(0)
  }

  const hitR1 = hit(laidOutDataMap, regions, 500, 10)
  expect(isHitFeature(hitR1)).toBe(true)
  if (isHitFeature(hitR1)) {
    expect(hitR1.feature.featureId).toBe('geneB')
    expect(hitR1.displayedRegionIndex).toBe(1)
  }
})

test('adjacent regions: shared boundary pixel goes to the later region', () => {
  // regionA ends at screen px 400; regionB starts at screen px 400. The mouse
  // at exactly px 400 must hit regionB, not regionA, otherwise clicks at the
  // boundary always steal into the earlier region.
  const dataA = makeData([makeItem('geneA', 0, 1000, 0, 20)])
  const dataB = makeData([makeItem('geneB', 0, 1000, 0, 20)])
  const laidOutDataMap = new Map([
    [0, dataA],
    [1, dataB],
  ])
  const regions = [
    makeRegion(0, 0, 1000, 0, 400),
    makeRegion(1, 0, 1000, 400, 800),
  ]

  const boundary = hit(laidOutDataMap, regions, 400, 10)
  expect(isHitFeature(boundary)).toBe(true)
  if (isHitFeature(boundary)) {
    expect(boundary.feature.featureId).toBe('geneB')
    expect(boundary.displayedRegionIndex).toBe(1)
  }
})

test('multi-region continues to next region when first has no hit', () => {
  // region 0 is within X range but has no feature at Y=999; region 1 has a feature
  const data1 = makeData([makeItem('geneA', 100, 400, 0, 20)])
  const data2 = makeData([makeItem('geneB', 100, 400, 0, 20)])
  const laidOutDataMap = new Map([
    [0, data1],
    [1, data2],
  ])
  const regions = [
    makeRegion(0, 0, 1000, 0, 800),
    makeRegion(1, 0, 1000, 0, 800),
  ]

  expect(hit(laidOutDataMap, regions, 100, 999).feature).toBeNull()
  const h = hit(laidOutDataMap, regions, 100, 10)
  expect(isHitFeature(h)).toBe(true)
  if (isHitFeature(h)) {
    expect(h.feature.featureId).toBe('geneA')
    expect(h.displayedRegionIndex).toBe(0)
  }
})

function makeAa(
  aminoAcid: string,
  startBp: number,
  endBp: number,
  proteinIndex: number,
): AminoAcidOverlayItem {
  return makeAminoAcidOverlayItem({
    aminoAcid,
    startBp,
    endBp,
    proteinIndex,
  })
}

test('returns the amino-acid codon under the cursor', () => {
  const data = makeData(
    [makeItem('gene1', 1000, 5000, 0, 20)],
    [],
    [makeAa('M', 1000, 1003, 0), makeAa('K', 1003, 1006, 1)],
  )
  // 0.10025 frac of 10000bp ≈ 1002.5bp → inside the first codon (1000-1003)
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    80,
    10,
  )
  expect(isHitFeature(result)).toBe(true)
  if (isHitFeature(result)) {
    expect(result.feature.featureId).toBe('gene1')
    expect(result.peptide?.aminoAcid).toBe('M')
  }
})

test('null peptide when feature hit but no codon under cursor', () => {
  const data = makeData(
    [makeItem('gene1', 1000, 5000, 0, 20)],
    [],
    [makeAa('M', 1000, 1003, 0)],
  )
  // 4000bp is inside the feature but past the only codon
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    320,
    10,
  )
  expect(isHitFeature(result)).toBe(true)
  if (isHitFeature(result)) {
    expect(result.feature.featureId).toBe('gene1')
    expect(result.peptide).toBeNull()
  }
})

test('bpPos is floored to an integer even when the mouse pixel maps to a fractional base', () => {
  const data = makeData([makeItem('gene1', 1000, 5000, 0, 20)])
  // 81px of an 800px-wide, 10000bp region -> frac 0.10125 -> bpPos 1012.5, a
  // genuinely fractional base that the old unfloored code returned as-is and
  // fed straight into the HGVS formatter (`c.93.66`-style tooltip text).
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    81,
    10,
  )
  expect(isHitFeature(result)).toBe(true)
  if (isHitFeature(result)) {
    expect(result.bpPos).toBe(1012)
    expect(Number.isInteger(result.bpPos)).toBe(true)
  }
})

// The only encoding LGV emits: calculateDynamicBlocks always orders
// start < end and carries the flip in `reversed`.
test('handles reversed region with explicit flag', () => {
  // Reversed flag set + start<end: mouseX=500 maps to vr.end - 0.625*span = 3750
  const data = makeData([makeItem('gene1', 3000, 4000, 0, 20)])
  const region = makeRegion(0, 0, 10000, 0, 800, true)
  const result = hit(new Map([[0, data]]), [region], 500, 10)
  expect(result.feature!.featureId).toBe('gene1')
})

// Reversed, base b paints across pixels ((end-b-1)/bpPerPx, (end-b)/bpPerPx],
// so the coordinate a pixel inverts to lands in (b, b+1] — flooring it named
// b+1 on each base's leftmost column, and named `end` (outside the region
// entirely) on the block's first column.
test('reversed base zoom resolves each pixel column to the base painted there', () => {
  // 10bp across 100px, flipped: base 1009 is leftmost, 1000 rightmost.
  const data = makeData([makeItem('gene1', 1000, 1010, 0, 20)])
  const region = makeRegion(0, 1000, 1010, 0, 100, true)
  const bpAt = (x: number) => {
    const result = hit(new Map([[0, data]]), [region], x, 10)
    return isHitFeature(result) ? result.bpPos : undefined
  }
  expect(bpAt(0)).toBe(1009)
  expect(bpAt(5)).toBe(1009)
  expect(bpAt(9.9)).toBe(1009)
  expect(bpAt(10)).toBe(1008)
  expect(bpAt(99.9)).toBe(1000)
})

test('forward base zoom resolves each pixel column to the base painted there', () => {
  const data = makeData([makeItem('gene1', 1000, 1010, 0, 20)])
  const region = makeRegion(0, 1000, 1010, 0, 100)
  const bpAt = (x: number) => {
    const result = hit(new Map([[0, data]]), [region], x, 10)
    return isHitFeature(result) ? result.bpPos : undefined
  }
  expect(bpAt(0)).toBe(1000)
  expect(bpAt(9.9)).toBe(1000)
  expect(bpAt(10)).toBe(1001)
  expect(bpAt(99.9)).toBe(1009)
})

function makeDataWithLabel(
  flatbushItems: FlatbushItem[],
  labelTextWidth: number,
): FeatureDataResult {
  const data = makeData(flatbushItems)
  const item = flatbushItems[0]!
  return {
    ...data,
    floatingLabelsData: new Map([
      [
        item.featureId,
        {
          featureId: item.featureId,
          minX: item.startBp,
          maxX: item.endBp,
          topY: 0,
          featureHeight: item.bottomPx - item.topPx,
          nameLabel: {
            text: 'longname',
            relativeY: 0,
            color: '#000',
            textWidth: labelTextWidth,
          },
        },
      ],
    ]),
  }
}

test('hit pad expands hit area on both sides of small features', () => {
  // 1 bp/px, feature 1000-1010. HIT_PAD_PX=4 so hit zone is 996..1014.
  const data = makeData([makeItem('gene1', 1000, 1010, 0, 20)])
  const region = makeRegion(0, 0, 2000, 0, 2000) // 1 bp/px
  expect(hit(new Map([[0, data]]), [region], 997, 10).feature?.featureId).toBe(
    'gene1',
  )
  expect(hit(new Map([[0, data]]), [region], 1013, 10).feature?.featureId).toBe(
    'gene1',
  )
  expect(hit(new Map([[0, data]]), [region], 990, 10).feature).toBeNull()
  expect(hit(new Map([[0, data]]), [region], 1020, 10).feature).toBeNull()
})

test('hit pad expands un-stranded features equally', () => {
  const data = makeData([makeItem('region1', 500, 502, 0, 20)])
  const region = makeRegion(0, 0, 2000, 0, 2000) // 1 bp/px
  expect(hit(new Map([[0, data]]), [region], 498, 10).feature?.featureId).toBe(
    'region1',
  )
  expect(hit(new Map([[0, data]]), [region], 505, 10).feature?.featureId).toBe(
    'region1',
  )
})

test('label hit area extends past feature when showLabels is true', () => {
  const data = makeDataWithLabel([makeItem('gene1', 1000, 1100, 0, 20)], 200)
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    250,
    10,
    { ...DEFAULT_LABELS, showLabels: true },
  )
  expect(result.feature).not.toBeNull()
})

test('label hit area collapses when showLabels is false', () => {
  const data = makeDataWithLabel([makeItem('gene1', 1000, 1100, 0, 20)], 200)
  const result = hit(
    new Map([[0, data]]),
    [makeRegion(0, 0, 10000, 0, 800)],
    250,
    10,
    { ...DEFAULT_LABELS, showLabels: false },
  )
  expect(result.feature).toBeNull()
})

test('subfeature label hit area is reserved when the label is present', () => {
  const makeDataWithSubLabel = (): FeatureDataResult => {
    const items = [makeItem('gene1', 1000, 1100, 0, 20)]
    const data = makeData(items)
    const item = items[0]!
    return {
      ...data,
      floatingLabelsData: new Map([
        [
          item.featureId,
          {
            featureId: item.featureId,
            minX: item.startBp,
            maxX: item.endBp,
            topY: 0,
            featureHeight: item.bottomPx - item.topPx,
            subfeatureLabel: {
              text: 'subname',
              relativeY: 0,
              color: '#000',
              textWidth: 200,
              isOverlay: false,
            },
          },
        ],
      ]),
    }
  }
  const regions = [makeRegion(0, 0, 10000, 0, 800)]
  // 250px is past the 100bp feature but within the reserved subfeature label;
  // subfeature labels always render when present, so the width is reserved.
  const shown = hit(new Map([[0, makeDataWithSubLabel()]]), regions, 250, 10, {
    ...DEFAULT_LABELS,
    showLabels: false,
  })
  expect(shown.feature).not.toBeNull()
})
