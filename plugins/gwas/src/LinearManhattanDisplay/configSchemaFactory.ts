import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

// Reuses LinearWiggleDisplay's schema, but overrides `color` so we don't
// inherit wiggle's bicolor sentinel (`#f0f`). Manhattan is single-color and
// supports per-feature jexl callbacks.
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {
      color: {
        type: 'color',
        defaultValue: '#0068d1',
        description: 'CSS color or jexl callback for Manhattan points',
      },
      // LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point
      // by its r² to the index SNP, read from `ldAdapter`.
      colorBy: {
        type: 'stringEnum',
        model: types.enumeration('GwasColorBy', ['normal', 'ld']),
        defaultValue: 'normal',
        description: 'How to color Manhattan points',
      },
      // PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying
      // pairwise r² used when colorBy is 'ld'.
      ldAdapter: {
        type: 'frozen',
        defaultValue: undefined,
        description: 'Adapter config for PLINK .ld pairwise r² data',
      },
    },
    {
      baseConfiguration: linearWiggleDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
