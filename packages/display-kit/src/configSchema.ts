import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { retiredFilterSpelling } from './jexlFilterConfigSchemaFields.ts'
import { regionTooLargeConfigSchemaFields } from './regionTooLargeConfigSchemaFields.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * The slots v1-v4's base display declared that no display reads now, and
 * `jexlFilters`, which lifts into `filter` where a display declares it. The
 * base declares it, and a display standing apart from the base (wiggle, Hi-C,
 * LD, the mark display) spreads it; a name a display still declares is left
 * alone, so `fetchSizeLimit` lifts nowhere a slot takes it, and `mouseover`
 * stays on the canvas feature displays, the ones whose hover reads it.
 */
export const retiredBaseDisplaySpellings = {
  maxFeatureScreenDensity: () => ({}),
  maxDisplayedBpPerPx: () => ({}),
  fetchSizeLimit: () => ({}),
  mouseover: () => ({}),
  ...retiredFilterSpelling,
}

/**
 * #config BaseLinearDisplay
 * #category display
 *
 * Shared base config for linear displays — its slots (`height`,
 * `fetchSizeLimit`) are common to all of them. The GPU stack's
 * `LinearCanvasBaseDisplay` config extends it, and third-party plugins extend
 * it too. `filter` is not here: it lives in
 * `jexlFilterConfigSchemaFields`, which only the displays that read it spread.
 * Nor is `mouseover`, which a display declares only where its hover reads it.
 */
const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    // `fetchSizeLimit` and `forceLoad`, which every display composing
    // `RegionTooLargeMixin` owes it. Here as the mixin's own table rather than
    // written out, so the five displays composing the mixin against a schema
    // that does NOT extend this one declare the same pair from the same place.
    ...regionTooLargeConfigSchemaFields,
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'default height for the track',
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'displayId',
    retired: retiredBaseDisplaySpellings,
  },
)

export default baseLinearDisplayConfigSchema

/**
 * What a mixin reading a base slot asks a composing display's `configuration`
 * to be. Narrow on purpose: `getConf`/`setConf` check a slot name against the
 * schema of the model handed to them, so a mixin reaching its host through
 * `AnyConfigurationModel` gets no check and every name typechecks. See
 * `ConfigModelForFields`, whose `BASE` parameter is the same idea for a mixin
 * that owns a field table as well.
 */
export type BaseLinearDisplayConfigModel = Instance<
  typeof baseLinearDisplayConfigSchema
>
