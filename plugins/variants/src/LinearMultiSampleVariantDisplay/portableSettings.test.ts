import { getContainingTrack } from '@jbrowse/core/util'

import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import { CONSEQUENCE_IMPACT_JEXL } from '../shared/variantConsequence.ts'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'

const configSchema = configSchemaFactory()
const { createDisplay } = createDisplayTestEnvironment<
  LinearMultiSampleVariantDisplayModel & {
    getPortableSettings: (id?: string) => Record<string, unknown>
  }
>({
  displayName: 'LinearMultiSampleVariantDisplay',
  configSchema,
  stateModel: stateModelFactory(configSchema),
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
    // The harness registers one display type, so the track config carries one
    // display node. Naming it as the port target is what makes the copy loop
    // run at all — an unmatched id silently skips it.
    const displays = getContainingTrack(display).configuration.displays as {
      displayId: string
    }[]
    return { display, targetId: displays[0]!.displayId }
  }

  it('ports a jexl featureColor across without evaluating it', () => {
    const { display, targetId } = setup(CONSEQUENCE_IMPACT_JEXL)
    expect(() => {
      display.getPortableSettings(targetId)
    }).not.toThrow()
    expect(display.featureColor).toBe(CONSEQUENCE_IMPACT_JEXL)
  })

  it('ports a plain color and the non-jexl slots', () => {
    const { display, targetId } = setup('#ff0000')
    display.setColorBy('population')
    display.getPortableSettings(targetId)
    expect(display.featureColor).toBe('#ff0000')
    expect(display.colorBy).toBe('population')
  })

  // Both are config slots, so they have to go through the slot copy: `height`
  // used to be returned in the instance snapshot, where MST drops a key no prop
  // declares, and a drag-resized track came back at the other display's default.
  it('ports the track height and a fixed row height as slots', () => {
    const { display, targetId } = setup('')
    display.resizeHeight(123)
    display.setRowHeight(7)
    const { height, rowHeight } = display
    const snapshot = display.getPortableSettings(targetId)
    expect(snapshot).not.toHaveProperty('height')
    expect(display.height).toBe(height)
    expect(display.rowHeight).toBe(rowHeight)
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
