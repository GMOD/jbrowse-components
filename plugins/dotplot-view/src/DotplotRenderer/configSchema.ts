import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'DotplotRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a synteny',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    },
    posColor: {
      type: 'color',
      description: 'the color for forward alignments',
      defaultValue: 'black',
    },
    negColor: {
      type: 'color',
      description: 'the color for reverse alignments',
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
        'mappingQuality',
        'strand',
        'none',
      ]),
      description: `Color by. Setting "identity" (similar to D-GENIES, use thresholds and thresholds palette to define colors for this setting), setting "mappingQuality" (uses mapping quality from PAF, some adapters don't have this setting), setting "strand" colors negative alignments with negColor and positive alignments with posColor, none is black`,
      defaultValue: 'strand',
    },
    thresholdsPalette: {
      type: 'stringArray',
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
    },
    thresholds: {
      type: 'stringArray',
      defaultValue: ['0.75', '0.5', '0.25', '0'],
    },
  },
  { explicitlyTyped: true },
)
