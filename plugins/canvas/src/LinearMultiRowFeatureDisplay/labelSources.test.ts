import { categoricalPalette } from '@jbrowse/core/ui/colors'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// Discovered rows come back sorted, so `dad` is row 0 wherever these name
// both.
function rows(names: string[], usedItemRgb = false): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: names,
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

function makeDisplay(
  data: MultiRowRegionData,
  displayConfig?: Record<string, unknown>,
) {
  const { display } = createTestEnvironment({ displayConfig }).createDisplay()
  display.setRpcData(0, data, ctgA)
  return display
}

it('leaves the labels untinted until asked', () => {
  const display = makeDisplay(rows(['mom', 'dad']))
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    undefined,
    undefined,
  ])
})

it('tints each label with the color its own row is painted in', () => {
  const display = makeDisplay(rows(['mom', 'dad']), { colorRowLabels: true })
  expect(display.labelSources.map(s => s.name)).toEqual(['dad', 'mom'])
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    categoricalPalette[0],
    categoricalPalette[1],
  ])
})

// A `sampleColorMap` row paints in the color the config named, so that is the
// color the label has to show.
it('follows the same precedence the blocks follow', () => {
  const display = makeDisplay(rows(['mom', 'dad']), {
    colorRowLabels: true,
    sampleColorMap: { dad: 'blue' },
  })
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    'blue',
    categoricalPalette[1],
  ])
})

// rowGroups spends the same label box and was asked for by name, so this
// derived tint yields. It also pulls `mom` to the front while the palette still
// indexes the unpartitioned order.
it('yields the label box to a rowGroups color', () => {
  const display = makeDisplay(rows(['mom', 'dad']), {
    colorRowLabels: true,
    rowGroups: [{ match: '^mom$', group: 'Parents', color: '#e41a1c' }],
  })
  expect(display.labelSources.map(s => s.name)).toEqual(['mom', 'dad'])
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    '#e41a1c',
    categoricalPalette[0],
  ])
})

// An itemRgb painting has no one color per row, so the toggle does nothing.
it('tints nothing in per-feature color mode', () => {
  const display = makeDisplay(rows(['mom', 'dad'], true), {
    colorRowLabels: true,
  })
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    undefined,
    undefined,
  ])
})
