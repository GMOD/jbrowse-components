import { resolvePalette } from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { paintFeatureBand } from '@jbrowse/plugin-canvas'

import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { LinearMultiSampleVariantDisplayModel } from './model.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

type LaneRecord = [id: string, start: number, end: number, description: string]

// The bovine pangenome's records at KIT (chr6:70,080,000) and TAS2R46
// (chr5:98,575,000), rebased to 0: a long record with nested ones inside it,
// which the lane's single row letters on top of each other. A kept label's
// strip spans its record's whole body, since a label that fits inside slides
// along it with the viewport, which is why `>7497>7498`, clear of the long
// record's text, still goes unnamed.
const KIT: LaneRecord[] = [
  ['>7493>7494', 3197, 3198, 'A -> 74bp'],
  ['>7494>7499', 19508, 40130, '20.6Kbp -> 1bp,37.5Kbp'],
  ['>7495>7496', 19532, 19533, '20.6Kbp,34Kbp,37.5Kbp -> 1.86Kbp'],
  ['>7496>7497', 24561, 24562, 'A -> 14.3Kbp'],
  ['>7497>7498', 34261, 34262, 'A -> 743bp'],
  ['>7499>7501', 47595, 47646, '51bp -> A'],
  ['>7501>7503', 77624, 77635, '11bp -> 91bp'],
]

const TAS2R46: LaneRecord[] = [
  ['>10042>10043', 9281, 9282, 'T -> 90bp'],
  ['>10043>10050', 12383, 29403, '17Kbp -> 18Kbp,C'],
  ['>10044>10046', 16668, 16727, '59bp -> A'],
  ['>10046>10047', 18057, 18058, 'T -> 661bp'],
  ['>10047>10048', 18553, 18554, 'C -> 282bp'],
  ['>10048>10049', 19842, 19843, 'A -> 73bp'],
]

function cellData(records: LaneRecord[]): CellDataResult {
  const index = new Flatbush(records.length, 16, Uint32Array)
  for (const [, start, end] of records) {
    index.add(start, 0, end, 1)
  }
  index.finish()
  return {
    mode: 'regular',
    samplePloidy: { S0: 2 },
    rowNames: ['S0'],
    hasPhasedOrHaploid: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    paintedDomain: [],
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    simplifiedFeatures: records.map(([id, start, end]) => ({
      id,
      data: { start, end, refName: 'ctgA', name: id },
    })),
    genotypeDict: ['0|1'],
    sampleNames: ['S0'],
    perRegionCellData: {
      0: {
        cellPositions: new Uint32Array(0),
        cellRowIndices: new Uint32Array(0),
        cellColors: new Uint32Array(0),
        cellShapeTypes: new Uint8Array(0),
        cellAltDosage: new Uint8Array(0),
        cellFeatureIndices: new Uint32Array(0),
        numCells: 0,
        refCellCount: 0,
        paintedCategories: 0,
        paintedDomain: [],
        featureGenotypeMap: Object.fromEntries(
          records.map(([id, start, end, description]) => [
            id,
            {
              ref: 'N',
              alt: ['N'],
              name: id,
              description,
              length: end - start,
              insertedBp: 0,
              type: 'SNV',
              genotypeCodes: new Uint32Array(),
            },
          ]),
        ),
        featureIdList: records.map(([id]) => id),
        featurePositions: Uint32Array.from(
          records.flatMap(([, start, end]) => [start, end]),
        ),
        featureIndexData: index.data,
        featureInsertedBp: new Int32Array(records.length),
        featureColors: new Uint32Array(records.length).fill(0xff00ff00),
      },
    },
  }
}

interface TextBox {
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

// What the band hands `fillText`, as boxes: the painter's own output, so this
// sees a collision whichever stage let it through.
function paintedText(display: LinearMultiSampleVariantDisplayModel) {
  const boxes: TextBox[] = []
  const fontSize = display.laneFontSize
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'fillText'
          ? (text: string, x: number, y: number) => {
              boxes.push({
                text,
                left: x,
                right: x + measureText(text, fontSize),
                top: y - fontSize + 0.5,
                bottom: y,
              })
            }
          : () => {},
      set: () => true,
    },
  ) as Ctx2D
  paintFeatureBand(
    ctx,
    display.laneLaidOutDataMap,
    display.renderBlocks,
    display.visibleRegions,
    {
      canvasWidth: display.canvasWidthPx,
      bandHeight: display.topBands.laneHeight,
      ...display.laneRenderedLabels,
      fontSize,
      palette: resolvePalette(),
    },
  )
  return boxes
}

function collisions(boxes: TextBox[]) {
  const out: [string, string][] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      if (
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom
      ) {
        out.push([a.text, b.text])
      }
    }
  }
  return out
}

// The figures' 1400px viewport, whose lane is ~1960 px of track.
function laneAt(records: LaneRecord[], bpPerPx: number) {
  const { display, view } = createTestEnvironment({
    displayConfig: { showVariantLane: true },
  }).createDisplay()
  view.setWidth(1960)
  view.setNewView(bpPerPx, 0)
  display.setCellData(cellData(records))
  return display
}

test.each([
  ['KIT', KIT, 51, ['>7493>7494', '>7494>7499', '>7499>7501', '>7501>7503']],
  ['TAS2R46', TAS2R46, 20, ['>10042>10043', '>10043>10050']],
])('the lane letters %s without overprinting', (_, records, bpPerPx, named) => {
  const boxes = paintedText(laneAt(records, bpPerPx))
  expect(collisions(boxes)).toEqual([])
  expect(boxes.map(b => b.text).filter(t => t.startsWith('>'))).toEqual(named)
})
