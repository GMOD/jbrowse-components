import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
import { MULTI_WIGGLE_RENDERING_TYPES } from '../util.ts'

export default ConfigurationSchema(
  'MultiLinearWiggleDisplay',
  {
    ...wiggleConfigSchemaFields,
    height: {
      type: 'number',
      defaultValue: 200,
      description: 'Default height of the track',
    },
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    },
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering', [...MULTI_WIGGLE_RENDERING_TYPES]),
      defaultValue: 'multirowxy',
      description: 'Default rendering type',
    },
  },
  { explicitlyTyped: true },
)
