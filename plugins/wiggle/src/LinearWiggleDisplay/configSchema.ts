import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
import { WIGGLE_COLOR_DEFAULT } from '../util.ts'

export default ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering type', [
        'xyplot',
        'density',
        'line',
        'scatter',
      ]),
      defaultValue: 'xyplot',
      description: 'Default rendering type',
    },
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'Default height of the track',
    },
    color: {
      type: 'color',
      defaultValue: WIGGLE_COLOR_DEFAULT,
      description: 'Color for the wiggle bars',
    },
    ...wiggleConfigSchemaFields,
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    },
  },
  { explicitlyTyped: true },
)
