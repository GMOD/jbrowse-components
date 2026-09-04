import { readConfObject } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import matrixConfigSchemaFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'
import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import { CONSEQUENCE_IMPACT_JEXL } from '../shared/variantConsequence.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const configSchema = configSchemaFactory()
const matrixConfigSchema = matrixConfigSchemaFactory()
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
    display.setColorBy('population')
    display.getPortableSettings(targetId)
    expect(target.featureColor).toBe('#ff0000')
    expect(readConfObject(target, 'colorBy')).toBe('population')
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
  // to survive the switch — and the unset state has to survive as unset, since
  // that is what follows the session-wide display-type default.
  it('ports the legend visibility, including the unset state', () => {
    const { display, target, targetId } = setup('')
    display.getPortableSettings(targetId)
    expect(readConfObject(target, 'showLegend')).toBeUndefined()

    display.setShowLegend(false)
    display.getPortableSettings(targetId)
    expect(readConfObject(target, 'showLegend')).toBe(false)
  })

  // The tree's provenance and the subtree filter are the two pieces of
  // instance state that only mean something beside the tree and the layout they
  // came with.
  it('carries the cluster provenance and subtree filter with the tree', () => {
    const { display, targetId } = setup('')
    const provenance = {
      regions: [{ refName: 'chr1', start: 0, end: 100 }],
      settings: [],
    }
    display.setLayoutAndClusterTree([{ name: 'a' }], '(a);', provenance)
    display.setSubtreeFilter(['a'])
    expect(display.getPortableSettings(targetId)).toMatchObject({
      clusterTree: '(a);',
      clusterProvenance: provenance,
      subtreeFilter: ['a'],
    })
  })
})
