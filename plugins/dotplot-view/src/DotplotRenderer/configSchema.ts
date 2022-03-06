import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'DotplotRenderer',
  {
    drawMode: {
      type: 'stringEnum',
      description: 'drawing mode',
      model: types.enumeration('Rendering', ['normal']),
      defaultValue: 'normal',
    },
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
      defaultValue: 2.5, // 2.5 is similar to D-GENIES
    },
    largeIndelLimit: {
      type: 'number',
      description:
        'Distance over which to not draw the connecting line for large D/I in CIGAR strings in base pairs. Very large deletions/insertions will be drawn with open circles across the boundary instead of being connected with large horizontal and vertical lines, often happens around centromeres with chain files',
      defaultValue: 1_000_000,
    },
    colorByMappingQual: {
      type: 'boolean',
      description:
        'Color by mapping quality. Note: not all adapters supply this e.g. .delta does not, PAF does though',
      defaultValue: false,
    },
    colorByIdentity: {
      type: 'boolean',
      description: 'Color by identity (similar to D-GENIES)',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)
