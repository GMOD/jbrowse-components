import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config GCContentAdapter
 * #trackType QuantitativeTrack
 * #fileFormat quantitative | GC content | Computed from the assembly sequence, no data file
 * #category adapter
 * Computes GC content (or GC skew) from an assembly's sequence at render time,
 * so there is no data file to prepare. `sequenceAdapter` is required and is
 * normally a copy of the assembly's own sequence adapter.
 *
 * #example
 * ```js
 * {
 *   type: 'GCContentAdapter',
 *   sequenceAdapter: {
 *     type: 'BgzipFastaAdapter',
 *     uri: 'https://example.com/hg38.fa.gz',
 *   },
 * }
 * ```
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
        advanced: true,
      },
      /**
       * #slot
       */
      windowDelta: {
        type: 'number',
        defaultValue: 100,
        advanced: true,
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
