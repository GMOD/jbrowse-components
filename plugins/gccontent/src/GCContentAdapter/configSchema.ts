import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GCContentAdapter
 * #category adapter
 */

const GCContentAdapterF = (_pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'GCContentAdapter',
    {
      /**
       * #slot
       */
      sequenceAdapter: {
        type: 'frozen',
        defaultValue: null,
      },
      /**
       * #slot
       */
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       */
      windowDelta: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       */
      gcMode: {
        type: 'stringEnum',
        model: types.enumeration('gcMode', ['content', 'skew']),
        defaultValue: 'content',
        description: 'calculate GC content fraction or GC skew (G-C)/(G+C)',
      },
    },
    { explicitlyTyped: true },
  )
}

export type GCContentAdapterConfig = Instance<
  ReturnType<typeof GCContentAdapterF>
>
export default GCContentAdapterF
