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
      contextVariable: ['feature'],
      defaultValue: '#f0f',
      description:
        'the color of each feature in a synteny, used with colorBy:default',
      type: 'color',
    },

    /**
     * #slot
     */
    colorBy: {
      defaultValue: 'default',
      description: `Color by options:<br/>
<ul>
  <li>"identity" - the identity of the particular hit, similar to D-GENIES, use the other config slots 'thresholds' and 'thresholdsPalette' to define colors for this setting</li>
  <li>"meanQueryIdentity" - calculates the weighted mean identity (weighted by alignment length) of all the hits that the query maps to (e.g. if the query is split aligned to many target, uses their weighted mean. can help show patterns of more related and distant synteny after WGD)</li>
  <li>"mappingQuality" - uses mapping quality from PAF, some adapters don't have this setting</li>
  <li>"strand" - colors negative alignments with negColor and positive alignments with posColor</li>
  <li>"default" - uses the 'color' config slot</li>
</ul>`,
      model: types.enumeration('colorBy', [
        'identity',
        'meanQueryIdentity',
        'mappingQuality',
        'strand',
        'default',
      ]),
      type: 'stringEnum',
    },

    /**
     * #slot
     */
    lineWidth: {
      defaultValue: 2.5,
      description: 'width of the lines to be drawn',
      type: 'number', // 2.5 is similar to D-GENIES
    },

    /**
     * #slot
     */
    negColor: {
      defaultValue: 'red',
      description: 'the color for reverse alignments, used with colorBy:strand',
      type: 'color',
    },

    /**
     * #slot
     */
    posColor: {
      defaultValue: 'blue',
      description: 'the color for forward alignments, used with colorBy:strand',
      type: 'color',
    },

    /**
     * #slot
     */
    thresholds: {
      defaultValue: ['0.75', '0.5', '0.25', '0'],
      description: 'threshold breakpoints, used with colorBy:identity',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    thresholdsPalette: {
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
      description: 'threshold colors, used with colorBy:identity',
      type: 'stringArray',
    },
  },
  { explicitlyTyped: true },
)
