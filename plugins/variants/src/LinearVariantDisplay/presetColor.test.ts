import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { CONSEQUENCE_IMPACT_JEXL } from '../shared/variantConsequence.ts'
import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function createDisplay() {
  return createDisplayTestEnvironment<LinearVariantDisplayModel>({
    trackType: 'VariantTrack',
    adapter: { name: 'TestAdapter', configOnly: true },
    displayName: 'LinearVariantDisplay',
    configSchema: pm => configSchemaF(pm),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
  }).createDisplay().display
}

function colorByRows(display: LinearVariantDisplayModel) {
  const colorBy = display
    .colorMenuItems()
    .find(i => 'label' in i && i.label === 'Color by...')
  return colorBy && 'subMenu' in colorBy ? resolveSubMenu(colorBy) : []
}

function checked(rows: MenuItem[]) {
  return rows
    .filter(i => 'checked' in i && i.checked)
    .map(i => ('label' in i ? i.label : undefined))
}

function clickRow(display: LinearVariantDisplayModel, label: string) {
  const row = colorByRows(display).find(i => 'label' in i && i.label === label)
  if (row && 'onClick' in row) {
    row.onClick()
  }
}

// The preset is a field of the colour object, as on the multi-sample
// displays, and the display paints it through the jexl function that
// computes it, since a VCF record carries no `impact` of its own.
test('Consequence impact writes the impact field', () => {
  const display = createDisplay()
  clickRow(display, 'Consequence impact')
  expect(display.colorSettings.field).toBe('impact')
  expect(display.colorsByConsequenceImpact).toBe(true)
  expect(display.colorEncoding).toBe(CONSEQUENCE_IMPACT_JEXL)
})

// Read as an ordinary attribute, the preset ticked Attribute... and offered a
// pin that does nothing.
test('a preset ticks its own row and nothing else', () => {
  const display = createDisplay()
  clickRow(display, 'SV type')
  expect(checked(colorByRows(display))).toEqual(['SV type'])
  expect(display.colorByMode).toBe('default')
  expect(display.colorByAttribute).toBe('')
})

test('the worker is sent the jexl colour, not the preset field', () => {
  const display = createDisplay()
  clickRow(display, 'Consequence impact')
  const { color } = display.rpcProps().displayConfig
  expect(color.value).toBe(CONSEQUENCE_IMPACT_JEXL)
  expect(color.field).toBe('')
})

test('Default parks the preset under none', () => {
  const display = createDisplay()
  clickRow(display, 'Consequence impact')
  clickRow(display, 'Default')
  expect(checked(colorByRows(display))).toEqual(['Default'])
  expect(display.rpcProps().displayConfig.color.field).toBe('impact')
  expect(display.colorEncoding).toBeUndefined()
})
