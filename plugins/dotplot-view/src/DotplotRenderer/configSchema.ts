import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config DotplotRenderer
 * #category renderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default ConfigurationSchema(
  'DotplotRenderer',
  {
    /**
     * #slot
     */
    color: {
      type: 'color',
      description:
        'the color of each feature in a synteny, used with colorBy:default',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    },

    /**
     * #slot
     */
    posColor: {
      type: 'color',
      description: 'the color for forward alignments, used with colorBy:strand',
      defaultValue: 'blue',
    },
    /**
     * #slot
     */
    negColor: {
      type: 'color',
      description: 'the color for reverse alignments, used with colorBy:strand',
      defaultValue: 'red',
    },

    /**
     * #slot
     */
    lineWidth: {
      type: 'number',
      description: 'width of the lines to be drawn',
      defaultValue: 2.5, // 2.5 is similar to D-GENIES
    },

    /**
     * #slot
     */
    colorBy: {
      type: 'stringEnum',
      model: types.enumeration('colorBy', [
        'identity',
        'meanQueryIdentity',
        'mappingQuality',
        'strand',
        'default',
      ]),
      description: `Color by options:<br/>
<ul>
  <li>"identity" - the identity of the particular hit, similar to D-GENIES, use the other config slots 'thresholds' and 'thresholdsPalette' to define colors for this setting</li>
  <li>"meanQueryIdentity" - calculates the weighted mean identity (weighted by alignment length) of all the hits that the query maps to (e.g. if the query is split aligned to many target, uses their weighted mean. can help show patterns of more related and distant synteny after WGD)</li>
  <li>"mappingQuality" - uses mapping quality from PAF, some adapters don't have this setting</li>
  <li>"strand" - colors negative alignments with negColor and positive alignments with posColor</li>
  <li>"default" - uses the 'color' config slot</li>
</ul>`,
      defaultValue: 'default',
    },

    /**
     * #slot
     */
    thresholdsPalette: {
      type: 'stringArray',
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
      description: 'threshold colors, used with colorBy:identity',
    },

    /**
     * #slot
     */
    thresholds: {
      type: 'stringArray',
      defaultValue: ['0.75', '0.5', '0.25', '0'],
      description: 'threshold breakpoints, used with colorBy:identity',
    },
  },
  { explicitlyTyped: true },
)
