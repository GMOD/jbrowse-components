import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getRoot, types, unprotect } from '@jbrowse/mobx-state-tree'

import { cellDataOf } from '../shared/cellData.fixture.ts'
import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'
import { withWalkColors } from './walkColors.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { HaplotypeColor, WalkColors } from './walkColors.ts'

function walksOf(...walks: HaplotypeColor[]): WalkColors {
  return Map.groupBy(walks, walk => walk.sample)
}

const GRAPH = walksOf(
  { sample: 'HG002', haplotype: 1, color: 'orange' },
  { sample: 'HG002', haplotype: 2, color: 'purple' },
  { sample: 'HG005', haplotype: 2, color: 'green' },
  { sample: 'HG006', color: 'teal' },
)

function colorsOf(rows: { name: string; color?: string }[]) {
  return Object.fromEntries(rows.map(row => [row.name, row.color]))
}

test('a haplotype row takes the walk of its phase, else its bare sample walk', () => {
  expect(
    colorsOf(
      withWalkColors(
        [
          { name: 'HG002 HP1', sampleName: 'HG002', HP: 0 },
          { name: 'HG002 HP2', sampleName: 'HG002', HP: 1 },
          { name: 'HG005 HP1', sampleName: 'HG005', HP: 0 },
          { name: 'HG006 HP1', sampleName: 'HG006', HP: 0 },
          { name: 'HG007 HP2', sampleName: 'HG007', HP: 1, color: 'red' },
        ],
        [GRAPH],
      ),
    ),
  ).toEqual({
    'HG002 HP1': 'orange',
    'HG002 HP2': 'purple',
    'HG005 HP1': undefined,
    'HG006 HP1': 'teal',
    'HG007 HP2': 'red',
  })
})

test('a sample row takes its walk where its walks share one color, and its own color first', () => {
  expect(
    colorsOf(
      withWalkColors(
        [
          { name: 'HG002', sampleName: 'HG002' },
          { name: 'HG005', sampleName: 'HG005' },
          { name: 'HG006', sampleName: 'HG006', color: 'red' },
        ],
        [GRAPH],
      ),
    ),
  ).toEqual({ HG002: undefined, HG005: 'green', HG006: 'red' })
})

test('the first graph track in track order with a match wins', () => {
  const later = walksOf(
    { sample: 'HG002', haplotype: 1, color: 'black' },
    { sample: 'HG005', haplotype: 1, color: 'black' },
  )
  expect(
    colorsOf(
      withWalkColors(
        [
          { name: 'HG002 HP1', sampleName: 'HG002', HP: 0 },
          { name: 'HG005 HP1', sampleName: 'HG005', HP: 0 },
        ],
        [GRAPH, later],
      ),
    ),
  ).toEqual({ 'HG002 HP1': 'orange', 'HG005 HP1': 'black' })
})

const graphConfigSchema = ConfigurationSchema(
  'GraphLikeDisplay',
  {},
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)

const GraphLikeDisplay = types
  .compose(
    'GraphLikeDisplay',
    BaseDisplay,
    types.model({
      type: types.literal('GraphLikeDisplay'),
      haplotypeColors: types.frozen<HaplotypeColor[]>([]),
    }),
  )
  .actions(self => ({
    setHaplotypeColors(colors: HaplotypeColor[]) {
      self.haplotypeColors = colors
    },
  }))

function viewWithGraphTrack() {
  const configSchema = configSchemaFactory()
  const { createDisplay } =
    createDisplayTestEnvironment<LinearVariantDisplayModel>({
      displayName: 'LinearVariantDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      extraDisplays: [
        {
          displayName: 'GraphLikeDisplay',
          configSchema: graphConfigSchema,
          stateModel: GraphLikeDisplay,
        },
      ],
      displayConfig: { records: { show: false }, rows: { field: 'haplotype' } },
    })
  const { view, display } = createDisplay()
  unprotect(getRoot(view))
  view.tracks.push({
    type: 'VariantTrack',
    configuration: 'test_track',
    displays: [{ type: 'GraphLikeDisplay' }],
  })
  display.setSources([{ name: 'HG002' }, { name: 'HG005' }])
  display.setCellData(cellDataOf({ samplePloidy: { HG002: 2, HG005: 2 } }))
  const graph = view.tracks[1]!.displays[0]
  return { view, display, graph }
}

function labelBars(display: LinearVariantDisplayModel) {
  return Object.fromEntries(display.drawnRows.map(r => [r.name, r.rowColor]))
}

test("a variant row's label bar follows a graph track in its view as it publishes and leaves", () => {
  const { view, display, graph } = viewWithGraphTrack()
  graph.setHaplotypeColors([
    { sample: 'HG002', haplotype: 2, color: '#ff7f0e' },
  ])
  expect(labelBars(display)).toEqual({
    'HG002 HP1': undefined,
    'HG002 HP2': '#ff7f0e',
    'HG005 HP1': undefined,
    'HG005 HP2': undefined,
  })

  graph.setHaplotypeColors([
    { sample: 'HG002', haplotype: 2, color: '#ff7f0e' },
    { sample: 'HG005', haplotype: 1, color: '#1f77b4' },
  ])
  expect(labelBars(display)['HG005 HP1']).toBe('#1f77b4')

  view.tracks.splice(1, 1)
  expect(Object.values(labelBars(display))).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
  ])
})
