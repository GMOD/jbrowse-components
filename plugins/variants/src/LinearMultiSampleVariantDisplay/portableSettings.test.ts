import {
  ConfigurationReference,
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingTrack } from '@jbrowse/core/util'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { types } from '@jbrowse/mobx-state-tree'

import matrixConfigSchemaFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'
import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import { CONSEQUENCE_IMPACT_JEXL } from '../shared/variantConsequence.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'

const configSchema = configSchemaFactory()
const matrixConfigSchema = matrixConfigSchemaFactory()
// the single-sample display a VariantTrack also offers, reduced to a config
// node with none of the multi-sample slots
const bareConfigSchema = ConfigurationSchema(
  'LinearVariantDisplay',
  {},
  { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
)
function bareStateModel(schema: AnyConfigurationSchemaType) {
  return types.compose(
    'LinearVariantDisplay',
    BaseDisplay,
    types.model({
      type: types.literal('LinearVariantDisplay'),
      configuration: ConfigurationReference(schema),
    }),
  )
}
const { createDisplay } = createDisplayTestEnvironment<
  LinearMultiSampleVariantDisplayModel & {
    getPortableSettings: (id?: string) => Record<string, unknown>
  }
>({
  displayName: 'LinearMultiSampleVariantDisplay',
  configSchema,
  stateModel: stateModelFactory(configSchema),
  // The real port is regular -> matrix, so the track needs both display nodes.
  // With one registered the only `displays` entry is the source's own, and
  // every assertion below passes by reading back what it wrote.
  extraDisplays: [
    {
      displayName: 'LinearMultiSampleVariantMatrixDisplay',
      configSchema: matrixConfigSchema,
      stateModel: matrixStateModelFactory(matrixConfigSchema),
    },
    {
      displayName: 'LinearVariantDisplay',
      configSchema: bareConfigSchema,
      stateModel: bareStateModel(bareConfigSchema),
    },
  ],
})

// Porting settings across a display-type switch writes each slot onto the target
// display's config. `featureColor` cannot be read for that with `getConf`: it
// holds a raw expression the worker evaluates per feature, so a read on the main
// thread evaluates `jexl:impactColor(feature)` with no feature bound and throws
// out of the track-menu click.
describe('getPortableSettings', () => {
  function setup(featureColor: string) {
    const { display } = createDisplay()
    display.setFeatureColor(featureColor)
    const displays = getContainingTrack(display).configuration
      .displays as (AnyConfigurationModel & {
      displayId: string
      featureColor: string
    })[]
    const target = displays.find(
      d => d.type === 'LinearMultiSampleVariantMatrixDisplay',
    )!
    return { display, target, targetId: target.displayId }
  }

  it('ports a jexl featureColor across without evaluating it', () => {
    const { display, target, targetId } = setup(CONSEQUENCE_IMPACT_JEXL)
    expect(() => {
      display.getPortableSettings(targetId)
    }).not.toThrow()
    // raw, not readConfObject: resolving it here is the very evaluation the
    // port avoids, and `impactColor` has no feature to bind
    expect(target.featureColor).toBe(CONSEQUENCE_IMPACT_JEXL)
  })

  it('ports a plain color and the non-jexl slots', () => {
    const { display, target, targetId } = setup('#ff0000')
    display.setRowColorField('population')
    display.getPortableSettings(targetId)
    expect(target.featureColor).toBe('#ff0000')
    expect(readConfObject(target, ['rowColor', 'field'])).toBe('population')
  })

  // Both are config slots, so they have to go through the slot copy: `height`
  // used to be returned in the instance snapshot, where MST drops a key no prop
  // declares, and a drag-resized track came back at the other display's default.
  it('ports the track height and a fixed row height as slots', () => {
    const { display, target, targetId } = setup('')
    display.resizeHeight(123)
    display.setRowHeight(7)
    const { height, rowHeight } = display
    const snapshot = display.getPortableSettings(targetId)
    expect(snapshot).not.toHaveProperty('height')
    expect(readConfObject(target, 'height')).toBe(height)
    expect(readConfObject(target, 'rowHeight')).toBe(rowHeight)
  })

  // A hidden legend is a deliberate sizing choice on a short track, so it has
  // to survive the switch.
  it('ports the legend visibility', () => {
    const { display, target, targetId } = setup('')
    display.getPortableSettings(targetId)
    expect(readConfObject(target, 'showLegend')).toBe(true)

    display.setShowLegend(false)
    display.getPortableSettings(targetId)
    expect(readConfObject(target, 'showLegend')).toBe(false)
  })

  it('ports the rows and their tints', () => {
    const { display, target, targetId } = setup('')
    display.applyDisplaySettings({
      rows: { domain: ['HG002', 'HG001'], labels: { HG002: 'Two' } },
      rowColor: { field: 'population', domain: ['HG001'], range: ['#123456'] },
    })
    display.getPortableSettings(targetId)
    expect(readConfObject(target, 'rows')).toEqual({
      domain: ['HG002', 'HG001'],
      labels: { HG002: 'Two' },
    })
    expect(readConfObject(target, 'rowColor')).toEqual({
      field: 'population',
      domain: ['HG001'],
      range: ['#123456'],
    })
  })

  // A drag on the sidebar edge writes a config slot, like the track height
  // above: returned in the instance snapshot instead, MST drops it and the
  // gutter silently resets on a switch.
  it('ports the tree sidebar width', () => {
    const { display, target, targetId } = setup('')
    display.setTreeAreaWidth(140)
    const snapshot = display.getPortableSettings(targetId)
    expect(snapshot).not.toHaveProperty('treeAreaWidth')
    expect(readConfObject(target, 'treeAreaWidth')).toBe(140)
  })

  it('ports the facet field and its band order', () => {
    const { display, target, targetId } = setup('')
    display.applyDisplaySettings({
      facet: { field: 'population', domain: ['EUR', 'AFR'] },
    })
    display.getPortableSettings(targetId)
    expect(readConfObject(target, 'facet')).toEqual({
      field: 'population',
      domain: ['EUR', 'AFR'],
    })
  })

  // The tree only means something beside the order it came with, and the
  // provenance and the focus beside the tree, so all four travel in `rows`.
  it('carries the tree, its provenance and the focus with the order', () => {
    const { display, target, targetId } = setup('')
    const provenance = {
      regions: [{ refName: 'chr1', start: 0, end: 100 }],
      settings: [],
    }
    display.setRowOrder([{ name: 'a' }], {
      tree: '(a);',
      provenance,
    })
    display.setRowFocus(['a'])
    expect(display.getPortableSettings(targetId)).toEqual({
      jexlFiltersSetting: undefined,
    })
    expect(readConfObject(target, 'rows')).toEqual({
      domain: ['a'],
      tree: '(a);',
      treeProvenance: provenance,
      kept: ['a'],
    })
  })

  // The track's other display types have none of these slots, and writing one
  // threw out of the Display types menu, leaving the track where it was
  it('ports nothing onto a display that is not multi-sample', () => {
    const { display } = createDisplay()
    const displays = getContainingTrack(display).configuration
      .displays as AnyConfigurationModel[]
    const target = displays.find(d => d.type === 'LinearVariantDisplay')!
    expect(display.getPortableSettings(target.displayId as string)).toEqual({})
  })
})
