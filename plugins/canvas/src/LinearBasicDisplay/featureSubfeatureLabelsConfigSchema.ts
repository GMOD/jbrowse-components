import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SUBFEATURE_LABEL_PLACEMENTS } from '../RenderFeatureDataRPC/displayModes.ts'

/**
 * #config FeatureSubfeatureLabels
 * #category display
 * The feature display's `labels.subfeatures`, the names of a feature's parts:
 * a gene's transcripts, a container's children, a polyprotein's cleavage
 * products. `collapsed` draws none.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', labels: { subfeatures: { placement: 'below' } } }
 * ```
 */
export const featureSubfeatureLabelsConfigSchema = ConfigurationSchema(
  'FeatureSubfeatureLabels',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: "draw the names of a feature's parts",
    },
    /**
     * #slot
     */
    placement: {
      type: 'stringEnum',
      model: types.enumeration('SubfeatureLabelPlacement', [
        ...SUBFEATURE_LABEL_PLACEMENTS,
      ]),
      defaultValue: 'auto',
      description:
        "`auto` names a polyprotein's cleavage products on their rows and no other part; `below` and `overlay` name every part, under its row or over it",
    },
  },
  { closed: true, plot: true },
)
