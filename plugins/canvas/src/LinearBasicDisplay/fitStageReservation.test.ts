import { setConf } from '@jbrowse/core/configuration'

import {
  makeFeatureData,
  makeFlatbushItem,
  packStackedGenes,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { maxBottom } from './layoutQueries.ts'
import { createTestEnvironment } from './testEnv.ts'

import type {
  FeatureDataResult,
  FloatingLabelsDataMap,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage, LabelReservation } from './fitLadder.ts'
import type * as Layout from './layout.ts'
import type { LayoutInputs } from './layoutInputs.ts'

// Every stack any packing memo handed back, keyed by the map itself, with the
// inputs that pack was called with. A rung that hands back another rung's stack
// by reference resolves to that stack's pack, which is the point: the stage's
// flags are checked against what was packed, not against what a rung says.
const mockPackedWith = new Map<
  ReadonlyMap<number, FeatureDataResult>,
  LayoutInputs
>()

jest.mock('./layout.ts', () => {
  const actual = jest.requireActual<typeof Layout>('./layout.ts')
  return {
    ...actual,
    createIncrementalLayout: (
      opts?: Parameters<typeof actual.createIncrementalLayout>[0],
    ) => {
      const memo = actual.createIncrementalLayout(opts)
      return (
        data: Parameters<typeof memo>[0],
        inputs: Parameters<typeof memo>[1],
      ) => {
        const out = memo(data, inputs)
        mockPackedWith.set(out, inputs)
        return out
      }
    },
  }
})

const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

// Overlapping multi-isoform genes, each with a name and a description and one
// worker-counted `below` label row, so every rung has something of its own to
// give up: descriptions (`labels`), transcripts (`isoforms`), names
// (`decimated`, `bodies`) and the label rows (`bare`).
function geneStack(count: number) {
  const data = packStackedGenes(
    Array.from({ length: count }, (_, i) => ({
      featureId: `g${i}`,
      name: `gene${i}`,
      startBp: 100 + i * 40,
      endBp: 100 + i * 40 + 30,
      isoforms: 4,
    })),
  )
  const floatingLabelsData: FloatingLabelsDataMap = new Map()
  for (const [id, label] of data.floatingLabelsData) {
    floatingLabelsData.set(id, {
      ...label,
      descriptionLabel: { text: `about ${id}`, relativeY: 0, textWidth: 90 },
    })
  }
  return makeFeatureData({
    ...data,
    flatbushItems: data.flatbushItems.map(f => ({ ...f, labelRows: 1 })),
    floatingLabelsData,
    labelKinds: { name: true, description: true, subfeature: true },
  })
}

// Narrow features under wide names whose start-to-start gap ramps, so
// decimation sheds names one at a time and the `decimated` rung is kept at
// heights where `labels` overflows.
function crowdedNames(count: number) {
  const features: { featureId: string; startBp: number; endBp: number }[] = []
  let pos = 100
  for (let i = 0; i < count; i++) {
    features.push({ featureId: `n${i}`, startBp: pos, endBp: pos + 5 })
    pos += 6 + 2 * i
  }
  const floatingLabelsData: FloatingLabelsDataMap = new Map()
  for (const f of features) {
    floatingLabelsData.set(f.featureId, {
      featureId: f.featureId,
      minX: f.startBp,
      maxX: f.endBp,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: f.featureId, relativeY: 0, textWidth: 40 },
      descriptionLabel: {
        text: `about ${f.featureId}`,
        relativeY: 0,
        textWidth: 80,
      },
    })
  }
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'feature',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: 10,
        featureHeightPx: 10,
        labelRows: 1,
      }),
    ),
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(() => 10)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    floatingLabelsData,
    labelKinds: { name: true, description: true, subfeature: true },
  })
}

const HEIGHT_MODES = ['fit', 'fixed', 'grow'] as const
type HeightMode = (typeof HEIGHT_MODES)[number]

interface Shape {
  heightMode: HeightMode
  everyIsoform: boolean
  below: boolean
  labels: boolean
}

const SHAPES: Shape[] = HEIGHT_MODES.flatMap(heightMode =>
  [false, true].flatMap(everyIsoform =>
    [false, true].flatMap(below =>
      [true, false].map(labels => ({
        heightMode,
        everyIsoform,
        below,
        labels,
      })),
    ),
  ),
)

const shapeName = (s: Shape) =>
  `${s.heightMode}${s.everyIsoform ? ' all-transcripts' : ''}${s.below ? ' below-rows' : ''}${s.labels ? '' : ' labels-off'}`

function standUp(shape: Shape, data: FeatureDataResult) {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  setConf(display, 'showLabels', shape.labels ? 'nameAndDescription' : 'none')
  if (shape.everyIsoform) {
    setConf(display, 'geneGlyphMode', 'all')
  }
  if (shape.below) {
    setConf(display, 'subfeatureLabels', 'below')
  }
  display.setRpcData(0, data, ctgA)
  display.setHeightMode(shape.heightMode)
  return display
}

const reservationOf = (
  s: Pick<LabelReservation, keyof LabelReservation>,
): LabelReservation => ({
  showLabels: s.showLabels,
  showDescriptions: s.showDescriptions,
  dropBelowLabelRows: s.dropBelowLabelRows,
})

// What each rung reserves, by name — the table the three rendered-flag getters
// used to spell out, kept here so a rung declaring the wrong reservation fails
// against the level it was kept at as well as against its own pack.
function reservationByLevel(
  level: FitStage['level'],
  display: { showLabels: boolean; effectiveShowDescriptions: boolean },
  heightMode: HeightMode,
): LabelReservation {
  const names = display.showLabels
  const descriptions = display.effectiveShowDescriptions
  switch (level) {
    case 'full':
      return {
        showLabels: names,
        showDescriptions: descriptions,
        dropBelowLabelRows: false,
      }
    case 'labels':
    case 'decimated':
      return {
        showLabels: names,
        showDescriptions: false,
        dropBelowLabelRows: false,
      }
    case 'isoforms':
      return {
        showLabels: names,
        showDescriptions: heightMode === 'fixed' && descriptions,
        dropBelowLabelRows: false,
      }
    case 'bodies':
      return {
        showLabels: false,
        showDescriptions: false,
        dropBelowLabelRows: false,
      }
    case 'bare':
      return {
        showLabels: false,
        showDescriptions: false,
        dropBelowLabelRows: true,
      }
  }
}

describe('the rung that packed a layout says what it reserved', () => {
  const reached = new Map<HeightMode, Set<FitStage['level']>>(
    HEIGHT_MODES.map(mode => [mode, new Set()]),
  )

  for (const data of [geneStack(6), crowdedNames(14)]) {
    for (const shape of SHAPES) {
      it(`at every height on ${shapeName(shape)} (${data.flatbushItems[0]!.featureId})`, () => {
        const display = standUp(shape, data)
        const fullHeight = maxBottom(display.baseLaidOutDataMap)
        expect(fullHeight).toBeGreaterThan(0)
        const heights =
          shape.heightMode === 'grow'
            ? [display.height]
            : Array.from(
                { length: Math.ceil((fullHeight + 20) / 3) },
                (_, i) => 3 + i * 3,
              )
        for (const height of heights) {
          if (shape.heightMode !== 'grow') {
            display.setHeight(height)
          }
          const stage = display.fitStage
          reached.get(shape.heightMode)!.add(stage.level)
          const packed = mockPackedWith.get(stage.layout)
          expect(packed).toBeDefined()
          expect(reservationOf(stage)).toEqual({
            showLabels: packed!.showLabels,
            showDescriptions: packed!.showDescriptions,
            dropBelowLabelRows: packed!.dropBelowLabelRows ?? false,
          })
          expect(reservationOf(stage)).toEqual(
            reservationByLevel(stage.level, display, shape.heightMode),
          )
          expect(display.renderedShowLabels).toBe(stage.showLabels)
          expect(display.renderedShowDescriptions).toBe(stage.showDescriptions)
          expect(display.renderedShowSubfeatureLabels).toBe(
            stage.scale >= 1 && !stage.dropBelowLabelRows,
          )
        }
      })
    }
  }

  // The sweep above is only as strong as the rungs it lands on.
  it('landed on every rung each ladder has', () => {
    expect([...reached.get('fit')!].sort()).toEqual(
      ['bare', 'bodies', 'decimated', 'full', 'isoforms', 'labels'].sort(),
    )
    expect([...reached.get('fixed')!].sort()).toEqual(['full', 'isoforms'])
    expect([...reached.get('grow')!]).toEqual(['full'])
  })
})
