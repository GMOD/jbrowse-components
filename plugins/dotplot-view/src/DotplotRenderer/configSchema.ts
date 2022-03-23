import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'DotplotRenderer',
  {
    color: {
      type: 'color',
      description:
        'the color of each feature in a synteny, used with colorBy:default',
      defaultValue: 'black',
      contextVariable: ['feature'],
    },
    posColor: {
      type: 'color',
      description: 'the color for forward alignments, used with colorBy:strand',
      defaultValue: 'black',
    },
    negColor: {
      type: 'color',
      description: 'the color for reverse alignments, used with colorBy:strand',
      defaultValue: 'red',
    },
    lineWidth: {
      type: 'number',
      description: 'width of the lines to be drawn',
      // 2.5 is similar to D-GENIES
      defaultValue: 2.5,
    },
    colorBy: {
      type: 'stringEnum',
      model: types.enumeration('colorBy', [
        'identity',
        'meanQueryIdentity',
        'mappingQuality',
        'strand',
        'default',
      ]),
      description: `Color by options:<br/><ul><li>"identity" - the identity of the particular hit, similar to D-GENIES, use the other config slots 'thresholds' and 'thresholdsPalette' to define colors for this setting</li><li>"meanQueryIdentity" - calculates the weighted mean of the identity of all the hits for the query</li><li>"mappingQuality" - uses mapping quality from PAF, some adapters don't have this setting</li><li>"strand" - colors negative alignments with negColor and positive alignments with posColor</li><li>"default" - uses the 'color' field, </li></ul>`,
      defaultValue: 'default',
    },
    thresholdsPalette: {
      type: 'stringArray',
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
      description: 'threshold colors, used with colorBy:identity',
    },
    thresholds: {
      type: 'stringArray',
      defaultValue: ['0.75', '0.5', '0.25', '0'],
      description: 'threshold breakpoints, used with colorBy:identity',
    },
  },
  { explicitlyTyped: true },
)
