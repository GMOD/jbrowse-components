import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config GCContentAdapter
 * #trackType GCContentTrack
 * #fileFormat quantitative | GC content | Computed from the assembly sequence, no data file
 * #category adapter
 * Computes GC content (or GC skew) from an assembly's sequence at render time,
 * so there is no data file to prepare: the sequence comes from the assembly
 * the track is displayed against. The window, the step and the mode are
 * this adapter's, which the `GCContentTrack` menu's GC parameters and GC skew
 * write.
 *
 * #example
 * ```js
 * {
 *   type: 'GCContentAdapter',
 * }
 * ```
 */

const GCContentAdapterF = (_pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'GCContentAdapter',
    {
      /**
       * #slot
       * don't set this — JBrowse computes GC from the assembly the track is
       * displayed against. It stays as an escape hatch for scoring some *other*
       * sequence, and setting it pins the track to that source even when the
       * assembly's own sequence changes
       */
      sequenceAdapter: {
        type: 'maybeFrozen',
        advanced: true,
      },
      /**
       * #slot
       * width in bp of the window each score is computed over, centered on the
       * position. 1 scores single bases; wider windows smooth the signal
       */
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       * step in bp between successive windows. Equal to `windowSize` (the
       * default) the windows tile without overlapping; smaller values overlap
       * them, giving a denser, smoother signal for proportionally more work
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
