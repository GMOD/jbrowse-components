import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { hoverTooltipRows } from './components/hoverReadout.ts'
import { computeLaidOutData } from './layout.ts'
import { WHOLE_REF } from './layoutTestUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { FloatingLabelsDataMap } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LayoutRegionData } from './layoutInputs.ts'

// 70 kb across 1400 px, the TAL1 view these marks come from
const BP_PER_PX = 50

interface Mark {
  featureId: string
  startBp: number
  endBp?: number
  named?: boolean
  densityFade?: boolean
}

function marks(features: Mark[]): LayoutRegionData {
  const spans = features.map(f => ({
    ...f,
    endBp: f.endBp ?? f.startBp + 1,
    named: f.named ?? true,
    densityFade: f.densityFade ?? true,
  }))
  const floatingLabelsData: FloatingLabelsDataMap = new Map(
    spans
      .filter(f => f.named)
      .map(f => [
        f.featureId,
        {
          featureId: f.featureId,
          minX: f.startBp,
          maxX: f.endBp,
          topY: 0,
          featureHeight: 10,
          nameLabel: { text: f.featureId, textWidth: 40 },
        },
      ]),
  )
  return {
    regionKey: 'v:ctgA',
    regionStart: WHOLE_REF.regionStart,
    regionEnd: WHOLE_REF.regionEnd,
    reversed: false,
    ...makeFeatureData({
      flatbushItems: spans.map(f =>
        makeFlatbushItem({
          featureId: f.featureId,
          type: 'SNV',
          startBp: f.startBp,
          endBp: f.endBp,
          bottomPx: 10,
          featureHeightPx: 10,
          densityFade: f.densityFade,
        }),
      ),
      rectPositions: new Uint32Array(spans.flatMap(f => [f.startBp, f.endBp])),
      rectYs: new Float32Array(spans.length),
      rectHeights: new Float32Array(spans.map(() => 10)),
      rectColors: new Uint32Array(spans.length),
      rectStrands: new Float32Array(spans.length),
      rectDensityFade: new Uint32Array(spans.map(f => (f.densityFade ? 1 : 0))),
      rectFeatureIndices: new Uint32Array(spans.map((_, i) => i)),
      floatingLabelsData,
    }),
  }
}

function pile(prefix: string, startBp: number, size = 28, spreadBp = 6) {
  return Array.from({ length: size }, (_, i) => ({
    featureId: `${prefix}${String(i).padStart(2, '0')}`,
    startBp: startBp + (i % spreadBp),
  }))
}

const tal1Shaped = [
  { featureId: 'enhancer1', startBp: 10_000 },
  { featureId: 'enhancer2', startBp: 10_002 },
  { featureId: 'snv1', startBp: 30_000 },
  { featureId: 'snv2', startBp: 30_000 },
  ...pile('patient', 40_000),
]

function laidOut(
  features: Mark[],
  { decimate = true, labelRoomFactor = 0, pinned = [] as string[] } = {},
) {
  return computeLaidOutData(new Map([[0, marks(features)]]), {
    bpPerPx: BP_PER_PX,
    showLabels: true,
    showDescriptions: false,
    displayMode: 'normal',
    pinnedFeatureIds: new Set(pinned),
    ...(decimate ? { labelDecimation: 'fitWidth', labelRoomFactor } : {}),
  }).get(0)!
}

function names(data: ReturnType<typeof laidOut>) {
  return [...data.floatingLabelsData.values()]
    .filter(l => l.nameLabel)
    .map(l => l.featureId)
    .sort()
}

function topOf(data: ReturnType<typeof laidOut>, id: string) {
  return data.flatbushItems.find(it => it.featureId === id)!.topPx
}

function tops(data: ReturnType<typeof laidOut>, prefix: string) {
  return new Set(
    data.flatbushItems
      .filter(it => it.featureId.startsWith(prefix))
      .map(it => it.topPx),
  )
}

describe('a pile of named marks too deep for any track', () => {
  it('folds onto one row under decimation and keeps one name', () => {
    const data = laidOut(tal1Shaped)
    expect(names(data)).toEqual([
      'enhancer1',
      'enhancer2',
      'patient00',
      'snv1',
      'snv2',
    ])
    expect(tops(data, 'patient').size).toBe(1)
  })

  it('marks every member with the size of its pile', () => {
    const data = laidOut(tal1Shaped)
    const sizes = data.flatbushItems
      .filter(it => it.featureId.startsWith('patient'))
      .map(it => it.pileSize)
    expect(new Set(sizes)).toEqual(new Set([28]))
    expect(
      data.flatbushItems.find(it => it.featureId === 'snv1')!.pileSize,
    ).toBeUndefined()
  })

  it('keeps every name and every row where the fit does not decimate', () => {
    const data = laidOut(tal1Shaped, { decimate: false })
    expect(names(data)).toHaveLength(32)
    expect(tops(data, 'patient').size).toBe(28)
  })

  it('picks the same leader whatever order the marks arrive in', () => {
    const reversed = laidOut([...tal1Shaped].reverse())
    expect(names(reversed)).toContain('patient00')
  })

  it('leaves a pinned member on its own row with its own name', () => {
    const data = laidOut(tal1Shaped, { pinned: ['patient17'] })
    expect(names(data)).toEqual(expect.arrayContaining(['patient17']))
    expect(topOf(data, 'patient17')).not.toBe(topOf(data, 'patient00'))
  })

  it("measures the leader's room from the pile's edge, not the member beside it", () => {
    const data = laidOut(
      [...pile('p', 10_000), { featureId: 'lone', startBp: 20_000 }],
      { labelRoomFactor: 1 },
    )
    expect(names(data)).toEqual(expect.arrayContaining(['p00', 'lone']))
  })

  it('stacks two nearby piles so their leaders never overprint', () => {
    const data = laidOut([...pile('a', 40_000), ...pile('b', 41_500)])
    expect(names(data)).toEqual(['a00', 'b00'])
    expect(topOf(data, 'a00')).not.toBe(topOf(data, 'b00'))
  })

  it('keeps a hotspot with one named mark on top of a deletion spanning it', () => {
    const hotspot = pile('snv', 20_000, 30, 8).map((m, i) => ({
      ...m,
      named: i === 0,
    }))
    const data = laidOut([
      { featureId: 'deletion', startBp: 0, endBp: 60_000, named: false },
      ...hotspot,
    ])
    expect(tops(data, 'snv')).toEqual(new Set([0]))
    expect(topOf(data, 'deletion')).toBeGreaterThan(0)
  })

  it('marks as folded only the names the fold left undrawn', () => {
    const lonelyName = pile('snv', 20_000, 30, 8).map((m, i) => ({
      ...m,
      named: i === 0,
    }))
    expect(laidOut(lonelyName).flatbushItems.some(it => it.foldedName)).toBe(
      false,
    )
    const folded = laidOut(tal1Shaped).flatbushItems.filter(it => it.foldedName)
    expect(folded).toHaveLength(27)
  })

  it('names the fold in the hover tooltip of every member', () => {
    const data = laidOut(tal1Shaped)
    const item = data.flatbushItems.find(it => it.featureId === 'patient05')!
    expect(
      hoverTooltipRows({
        feature: item,
        subfeature: undefined,
        peptide: undefined,
        displayedRegionIndex: 0,
        bpPos: 40_000,
        bpPerPx: BP_PER_PX,
      }),
    ).toContain('one of 28 drawn here')
  })
})

describe('the fit ladder over a pile of named marks', () => {
  const ctgA = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 10_000,
  }
  // The TAL1 shape on the test view's 10 kb, at 10 bp/px: every mark still
  // narrower than a pixel
  const onTestView = tal1Shaped.map(m => ({
    ...m,
    startBp: Math.round(m.startBp / 10) + (m.startBp % 10),
  }))

  function fitDisplay(height: number) {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.zoomTo(10)
    view.scrollTo(0)
    display.setRpcData(0, marks(onTestView), ctgA)
    view.settleCoarseBlocks()
    display.setHeightMode('fit')
    display.setHeight(height)
    return display
  }

  it('draws every name but the pile’s at 60 px, and says some names went', () => {
    const display = fitDisplay(60)
    expect(display.fitStage.level).toBe('decimated')
    expect(display.renderedLabels.showLabels).toBe(true)
    expect(names(display.laidOutDataMap.get(0)!)).toEqual([
      'enhancer1',
      'enhancer2',
      'patient00',
      'snv1',
      'snv2',
    ])
    expect(display.fitDrops.names).toBe('some')
  })

  it('never folds a fixed-height track', () => {
    const display = fitDisplay(60)
    display.setHeightMode('fixed')
    expect(names(display.laidOutDataMap.get(0)!)).toHaveLength(32)
  })
})
