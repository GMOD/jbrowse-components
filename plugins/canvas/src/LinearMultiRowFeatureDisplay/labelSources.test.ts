import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// Discovered rows come back sorted, so `dad` is row 0 wherever these name
// both.
function rows(names: string[], usedItemRgb = false): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    rowValues: names,
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb,
    rowsFieldCandidates: [],
    rowsFieldCandidateValues: [],
    legendCandidates: [],
    resolvedRowsField: 'name',
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

// The rows have a lane each, so no palette deals them a colour by name.
it('tints no label where nothing gives its row a colour', () => {
  const display = makeDisplay(rows(['mom', 'dad']), { colorRowLabels: true })
  expect(display.labelSources.map(s => s.name)).toEqual(['dad', 'mom'])
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    undefined,
    undefined,
  ])
})

// Clustering, a sort or a drag rewrites `rows.domain`, and none of them is a
// request to recolor.
it('keeps each row its color through a reorder', () => {
  const display = makeDisplay(rows(['mom', 'dad']))
  const before = new Map(
    display.sources.map((s, i) => [s.name, display.rowColorStringsByIndex[i]]),
  )
  display.setRowOrder([{ name: 'mom' }, { name: 'dad' }])
  expect(display.sources.map(s => s.name)).toEqual(['mom', 'dad'])
  expect(display.rowColorStringsByIndex).toEqual([
    before.get('mom'),
    before.get('dad'),
  ])
})

// A `rowColor` row paints in the color the config named, so that is the
// color the label has to show.
it('follows the same precedence the blocks follow', () => {
  const display = makeDisplay(rows(['mom', 'dad']), {
    colorRowLabels: true,
    rowColor: { domain: ['dad'], range: ['blue'] },
  })
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    'blue',
    undefined,
  ])
})

// rowGroups spends the same label box and was asked for by name, so this
// derived tint yields. Its band pulls `mom` to the front.
it('yields the label box to a rowGroups color', () => {
  const display = makeDisplay(rows(['mom', 'dad']), {
    colorRowLabels: true,
    rowGroups: [{ match: '^mom$', group: 'Parents', color: '#e41a1c' }],
    rowColor: { domain: ['mom', 'dad'], range: ['blue', 'green'] },
    facet: 'group',
  })
  expect(display.labelSources.map(s => s.name)).toEqual(['mom', 'dad'])
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    '#e41a1c',
    'green',
  ])
})

// Under an itemRgb painting a row's colour paints no block, and still tints
// its label.
it('tints the label with a pair the blocks do not paint', () => {
  const display = makeDisplay(rows(['mom', 'dad'], true), {
    colorRowLabels: true,
    rowColor: { domain: ['dad'], range: ['blue'] },
  })
  expect(display.rowColorStringsByIndex).toEqual([undefined, undefined])
  expect(display.labelSources.map(s => s.labelColor)).toEqual([
    'blue',
    undefined,
  ])
})
