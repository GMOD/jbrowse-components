import { LITERAL } from '../RenderFeatureDataRPC/colorClasses.ts'
import { packRenderArrays } from '../RenderFeatureDataRPC/packRenderArrays.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'
import {
  makeAminoAcidOverlayItem,
  makeFeatureData,
  makeFlatbushItem,
  makeSubfeatureInfo,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  cloneMutableFields,
  applyLayoutToRegion,
  scaleLaidOutData,
} from './applyLayout.ts'
import { applyIsoformGapFloor } from './isoformGapFloor.ts'
import { applyIsoformTrim } from './isoformTrim.ts'
import { shiftDrawnYLanes, shiftYLanes } from './yLanes.ts'
import { interpolateYData } from './yMorph.ts'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
  FeatureLabelData,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

// Each type that carries geometry is classified field by field, so a new field
// stops compiling here until someone decides whether it is a y. A 'y' joins
// `readYEntries`, which every site below is held to; a height or a row count
// scales but is not a coordinate, so it is 'other'.
type Lane = 'y' | 'other'

const featureDataLanes = {
  rectPositions: 'other',
  rectYs: 'y',
  rectHeights: 'other',
  rectColors: 'other',
  rectStrands: 'other',
  rectDensityFade: 'other',
  rectColorClasses: 'other',
  rectColorValues: 'other',
  rectLabelRows: 'other',
  rectChildOrdinals: 'other',
  linePositions: 'other',
  lineYs: 'y',
  lineColors: 'other',
  lineDirections: 'other',
  lineColorClasses: 'other',
  lineLabelRows: 'other',
  lineChildOrdinals: 'other',
  arrowXs: 'other',
  arrowYs: 'y',
  arrowHeights: 'other',
  arrowWidthsBp: 'other',
  arrowGene: 'other',
  arrowDirections: 'other',
  arrowColors: 'other',
  arrowColorClasses: 'other',
  arrowLabelRows: 'other',
  arrowChildOrdinals: 'other',
  flatbushItems: 'other',
  subfeatureInfos: 'other',
  rectFeatureIndices: 'other',
  lineFeatureIndices: 'other',
  arrowFeatureIndices: 'other',
  floatingLabelsData: 'other',
  labelKinds: 'other',
  aminoAcidOverlay: 'other',
  colorValues: 'other',
  featureCount: 'other',
  hasMultiIsoformGenes: 'other',
  isoformPicks: 'other',
  bytes: 'other',
  unreadFilterFields: 'other',
} satisfies Record<keyof FeatureDataResult, Lane>

const flatbushLanes = {
  kind: 'other',
  type: 'other',
  startBp: 'other',
  endBp: 'other',
  topPx: 'y',
  bottomPx: 'y',
  transcript: 'other',
  labelRows: 'other',
  featureHeightPx: 'other',
  tooltip: 'other',
  name: 'other',
  description: 'other',
  strand: 'other',
  groupKey: 'other',
  densityFade: 'other',
  gene: 'other',
  collapsibleIntrons: 'other',
  isoformStack: 'other',
  featureId: 'other',
} satisfies Record<keyof FlatbushItem, Lane>

const subfeatureLanes = {
  kind: 'other',
  type: 'other',
  startBp: 'other',
  endBp: 'other',
  topPx: 'y',
  bottomPx: 'y',
  transcript: 'other',
  labelRowsAbove: 'other',
  ownsLabelRow: 'other',
  parentFeatureId: 'other',
  displayLabel: 'other',
  childOrdinal: 'other',
  featureId: 'other',
} satisfies Record<keyof SubfeatureInfo, Lane>

const labelLanes = {
  featureId: 'other',
  labelRowsAbove: 'other',
  labelRows: 'other',
  minX: 'other',
  maxX: 'other',
  topY: 'y',
  featureHeight: 'other',
  nameLabel: 'other',
  descriptionLabel: 'other',
  moreIsoformsLabel: 'other',
  parentFeatureId: 'other',
  subfeatureLabel: 'other',
  childOrdinal: 'other',
} satisfies Record<keyof FeatureLabelData, Lane>

const aminoAcidLanes = {
  labelRowsAbove: 'other',
  childOrdinal: 'other',
  startBp: 'other',
  endBp: 'other',
  aminoAcid: 'other',
  proteinIndex: 'other',
  topPx: 'y',
  heightPx: 'other',
  isStopOrNonTriplet: 'other',
  isTranslExcept: 'other',
  flatbushIdx: 'other',
} satisfies Record<keyof AminoAcidOverlayItem, Lane>

function yNamesOf(lanes: Record<string, Lane>) {
  return Object.entries(lanes)
    .filter(([, lane]) => lane === 'y')
    .map(([name]) => name)
}

interface YEntry {
  key: string
  owner: string
  ordinal: number
  hitBox: boolean
  value: number
}

function readNumbers(item: object, names: string[]) {
  return names.map(name => [name, Number(Reflect.get(item, name))] as const)
}

function readYEntries(data: FeatureDataResult) {
  const out: YEntry[] = []
  const seen = new Map<string, number>()
  const add = (
    lane: string,
    owner: string,
    ordinal: number | undefined,
    hitBox: boolean,
    value: number,
  ) => {
    const base = `${lane}|${owner}|${ordinal ?? ROOT_CHILD_ORDINAL}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.push({
      key: `${base}|${n}`,
      owner,
      ordinal: ordinal ?? ROOT_CHILD_ORDINAL,
      hitBox,
      value,
    })
  }
  const items = data.flatbushItems
  expect(yNamesOf(featureDataLanes)).toEqual(['rectYs', 'lineYs', 'arrowYs'])
  for (const kind of ['rect', 'line', 'arrow'] as const) {
    const ys = data[`${kind}Ys`]
    const ordinals = data[`${kind}ChildOrdinals`]
    for (const [i, idx] of data[`${kind}FeatureIndices`].entries()) {
      add(
        `${kind}Ys`,
        items[idx]!.featureId,
        ordinals.length > 0 ? ordinals[i] : undefined,
        false,
        ys[i]!,
      )
    }
  }
  for (const item of items) {
    for (const [name, value] of readNumbers(item, yNamesOf(flatbushLanes))) {
      add(`flatbush.${name}`, item.featureId, undefined, true, value)
    }
  }
  for (const info of data.subfeatureInfos) {
    for (const [name, value] of readNumbers(info, yNamesOf(subfeatureLanes))) {
      add(
        `subfeature.${name}`,
        info.parentFeatureId,
        info.childOrdinal,
        true,
        value,
      )
    }
  }
  for (const label of data.floatingLabelsData.values()) {
    for (const [name, value] of readNumbers(label, yNamesOf(labelLanes))) {
      add(
        `label.${name}`,
        label.parentFeatureId ?? label.featureId,
        label.childOrdinal,
        false,
        value,
      )
    }
  }
  for (const aa of data.aminoAcidOverlay ?? []) {
    for (const [name, value] of readNumbers(aa, yNamesOf(aminoAcidLanes))) {
      add(
        `aminoAcid.${name}`,
        items[aa.flatbushIdx]!.featureId,
        aa.childOrdinal,
        false,
        value,
      )
    }
  }
  return out
}

function entryMap(data: FeatureDataResult) {
  return new Map(readYEntries(data).map(e => [e.key, e]))
}

function fixture() {
  const prim = (
    flatbushIdx: number,
    childOrdinal: number | undefined,
    y: number,
  ) => ({
    labelRowsAbove: 0,
    childOrdinal,
    colorClass: LITERAL,
    color: 0,
    y,
    flatbushIdx,
  })
  const flatbushItems = ['g0', 'g1'].map(featureId =>
    makeFlatbushItem({ featureId, topPx: 0, bottomPx: 10 }),
  )
  return makeFeatureData({
    ...packRenderArrays(
      [
        { ...prim(0, undefined, 1), start: 0, end: 5, height: 4, strand: 1 },
        { ...prim(0, 0, 2), start: 0, end: 5, height: 4, strand: 1 },
        { ...prim(0, 1, 3), start: 0, end: 5, height: 4, strand: 1 },
        { ...prim(1, undefined, 4), start: 0, end: 5, height: 4, strand: 1 },
      ],
      [
        { ...prim(0, 0, 5), start: 0, end: 5, direction: 1 },
        { ...prim(0, 1, 6), start: 0, end: 5, direction: 1 },
        { ...prim(1, undefined, 7), start: 0, end: 5, direction: 1 },
      ],
      [
        { ...prim(0, 0, 8), x: 2, height: 4, widthBp: 1, direction: 1 },
        { ...prim(0, 1, 9), x: 2, height: 4, widthBp: 1, direction: 1 },
        {
          ...prim(1, undefined, 10),
          x: 2,
          height: 4,
          widthBp: 1,
          direction: 1,
        },
      ],
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    flatbushItems,
    subfeatureInfos: [
      makeSubfeatureInfo({
        featureId: 't0',
        parentFeatureId: 'g0',
        childOrdinal: 0,
        topPx: 11,
        bottomPx: 12,
      }),
      makeSubfeatureInfo({
        featureId: 't1',
        parentFeatureId: 'g0',
        childOrdinal: 1,
        topPx: 13,
        bottomPx: 14,
      }),
      makeSubfeatureInfo({
        featureId: 't2',
        parentFeatureId: 'g1',
        topPx: 15,
        bottomPx: 16,
      }),
    ],
    floatingLabelsData: new Map([
      [
        'g0',
        { featureId: 'g0', minX: 0, maxX: 5, topY: 20, featureHeight: 10 },
      ],
      [
        't0',
        {
          featureId: 't0',
          parentFeatureId: 'g0',
          childOrdinal: 0,
          minX: 0,
          maxX: 5,
          topY: 21,
          featureHeight: 4,
        },
      ],
      [
        't1',
        {
          featureId: 't1',
          parentFeatureId: 'g0',
          childOrdinal: 1,
          minX: 0,
          maxX: 5,
          topY: 22,
          featureHeight: 4,
        },
      ],
      [
        'g1',
        { featureId: 'g1', minX: 0, maxX: 5, topY: 23, featureHeight: 10 },
      ],
    ]),
    aminoAcidOverlay: [
      makeAminoAcidOverlayItem({
        aminoAcid: 'M',
        proteinIndex: 0,
        flatbushIdx: 0,
        childOrdinal: 0,
        topPx: 30,
      }),
      makeAminoAcidOverlayItem({
        aminoAcid: 'K',
        proteinIndex: 1,
        flatbushIdx: 0,
        childOrdinal: 1,
        topPx: 31,
      }),
      makeAminoAcidOverlayItem({
        aminoAcid: 'L',
        proteinIndex: 0,
        flatbushIdx: 1,
        topPx: 32,
      }),
    ],
    featureCount: 2,
  })
}

function deltaBetween(before: Map<string, YEntry>, after: Map<string, YEntry>) {
  return new Map(
    [...before].flatMap(([key, entry]) => {
      const moved = after.get(key)
      return moved ? [[key, moved.value - entry.value] as const] : []
    }),
  )
}

const before = entryMap(fixture())

test('the fixture reaches every y lane at every ordinal', () => {
  const lanes = new Set([...before.keys()].map(k => k.split('|')[0]!))
  expect([...lanes]).toEqual([
    'rectYs',
    'lineYs',
    'arrowYs',
    'flatbush.topPx',
    'flatbush.bottomPx',
    'subfeature.topPx',
    'subfeature.bottomPx',
    'label.topY',
    'aminoAcid.topPx',
  ])
  for (const lane of lanes) {
    const ordinals = new Set(
      [...before.values()]
        .filter(e => e.key.startsWith(`${lane}|`))
        .map(e => e.ordinal),
    )
    expect(ordinals.has(1)).toBe(!lane.startsWith('flatbush'))
  }
})

test('shiftYLanes moves every y lane by its owner', () => {
  const data = cloneMutableFields(fixture())
  shiftYLanes(data, {
    byFeature: new Map([
      ['g0', 100],
      ['g1', 200],
    ]),
  })
  for (const [key, delta] of deltaBetween(before, entryMap(data))) {
    expect([key, delta]).toEqual([key, key.split('|')[1] === 'g0' ? 100 : 200])
  }
})

test('shiftYLanes moves one isoform row on its own', () => {
  const data = cloneMutableFields(fixture())
  shiftYLanes(data, {
    ofChild: (featureId, ordinal) =>
      featureId === 'g0' && ordinal === 1 ? 7 : 0,
  })
  for (const [key, delta] of deltaBetween(before, entryMap(data))) {
    const entry = before.get(key)!
    expect(delta).toBe(entry.owner === 'g0' && entry.ordinal === 1 ? 7 : 0)
  }
})

test('shiftYLanes with ofChild prices the root rows through it too', () => {
  const data = cloneMutableFields(fixture())
  shiftYLanes(data, {
    ofChild: (_featureId, ordinal) => (ordinal === ROOT_CHILD_ORDINAL ? 3 : 0),
  })
  for (const [key, delta] of deltaBetween(before, entryMap(data))) {
    expect(delta).toBe(before.get(key)!.ordinal === ROOT_CHILD_ORDINAL ? 3 : 0)
  }
})

test('applyLayoutToRegion drops the labels of an unplaced or unlaid feature', () => {
  const data = cloneMutableFields(fixture())
  applyLayoutToRegion(
    data,
    new Map([['g0', -1e6]]),
    new Map([
      ['g0', 10],
      ['g1', 10],
    ]),
    new Set(),
    new Set(),
    new Set(),
  )
  expect([...data.floatingLabelsData.keys()]).toEqual([])
})

test('shiftDrawnYLanes leaves the hit-test boxes where they are', () => {
  const data = cloneMutableFields(fixture())
  shiftDrawnYLanes(data, { byFeature: new Map([['g0', 5]]) })
  for (const [key, delta] of deltaBetween(before, entryMap(data))) {
    const entry = before.get(key)!
    expect(delta).toBe(!entry.hitBox && entry.owner === 'g0' ? 5 : 0)
  }
})

test('applyLayoutToRegion puts every y lane on its feature row', () => {
  const data = cloneMutableFields(fixture())
  applyLayoutToRegion(
    data,
    new Map([
      ['g0', 100],
      ['g1', 200],
    ]),
    new Map([
      ['g0', 10],
      ['g1', 10],
    ]),
    new Set(),
    new Set(),
    new Set(),
  )
  const after = entryMap(data)
  expect(after.size).toBe(before.size)
  for (const [key, delta] of deltaBetween(before, after)) {
    expect([key, delta]).toEqual([
      key,
      before.get(key)!.owner === 'g0' ? 100 : 200,
    ])
  }
})

test('applyIsoformGapFloor moves the spread isoform rows in every lane', () => {
  const data = cloneMutableFields(fixture())
  applyIsoformGapFloor(
    data,
    new Map([
      [
        'g0',
        {
          shiftPxByOrdinal: new Map([
            [0, 0],
            [1, 4],
          ]),
          totalPx: 4,
        },
      ],
    ]),
  )
  for (const [key, delta] of deltaBetween(before, entryMap(data))) {
    const entry = before.get(key)!
    expect(delta).toBe(entry.owner === 'g0' && entry.ordinal === 1 ? 4 : 0)
  }
})

test('applyIsoformTrim drops and lifts isoform rows in every lane', () => {
  const data = cloneMutableFields(fixture())
  applyIsoformTrim(data, {
    trims: new Map([
      [
        'g0',
        {
          keptOrdinals: new Set([1]),
          shiftPxByOrdinal: new Map([[1, 6]]),
          shiftLabelRowsByOrdinal: new Map([[1, 0]]),
          heightPx: 10,
          labelRows: 0,
          startBp: 0,
          endBp: 5,
          hidden: 1,
        },
      ],
    ]),
    badges: new Map(),
  })
  const after = entryMap(data)
  for (const [key, entry] of before) {
    const dropped = entry.owner === 'g0' && entry.ordinal === 0
    expect([key, after.has(key)]).toEqual([key, !dropped])
    if (!dropped) {
      expect(after.get(key)!.value - entry.value).toBe(
        entry.owner === 'g0' && entry.ordinal === 1 ? -6 : 0,
      )
    }
  }
})

test('scaleLaidOutData scales every y lane', () => {
  const scaled = scaleLaidOutData(new Map([[0, fixture()]]), 0.5).get(0)!
  for (const [key, entry] of entryMap(scaled)) {
    expect([key, entry.value]).toEqual([key, before.get(key)!.value * 0.5])
  }
})

test('interpolateYData eases the drawn lanes and leaves the hit-test boxes', () => {
  const target = new Map([[0, fixture()]])
  const eased = interpolateYData(
    new Map([
      ['g0', 20],
      ['g1', 40],
    ]),
    target,
    0.5,
  ).get(0)!
  for (const [key, delta] of deltaBetween(before, entryMap(eased))) {
    const entry = before.get(key)!
    expect(delta).toBe(entry.hitBox ? 0 : entry.owner === 'g0' ? 10 : 20)
  }
})
