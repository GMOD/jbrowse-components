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
})
