import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { AUTO_STEP, WINDOW_DEFAULT } from './gcWindow.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config GCContentAdapter
 * #trackType GCContentTrack
 * #fileFormat quantitative | GC content | Computed from the assembly sequence, no data file
 * #category adapter
 * Computes GC content (or GC skew) from an assembly's sequence at render time,
 * so there is no data file to prepare: the sequence comes from the assembly
 * the track is displayed against. Each score is the `op` over a `window` of
 * bases, one every `step`; the `GCContentTrack` menu's GC parameters write
 * all three.
 *
 * Only A, C, G and T count. N and the ambiguity codes are left out of both the
 * fraction and its denominator, so a window holding no A, C, G or T, such as
 * an assembly gap, has no score, nor does a skew window holding no G or C.
 *
 * #example
 * ```js
 * {
 *   type: 'GCContentAdapter',
 * }
 * ```
 *
 * #example
 * GC skew in fixed 10 kb windows every 1 kb:
 * ```js
 * {
 *   type: 'GCContentAdapter',
 *   op: 'skew',
 *   window: 10000,
 *   step: 1000,
 * }
 * ```
 */

const GCContentAdapterF = (_pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'GCContentAdapter',
    {
      /**
       * #slot
       * the sequence scored in place of the assembly's own, such as a
       * hard-masked FASTA on the same coordinates. Unset, the track scores the
       * sequence of the assembly it is shown against, and follows that
       * assembly's sequence if it changes
       */
      sequenceAdapter: {
        type: 'maybeFrozen',
        holds: 'adapter',
        advanced: true,
      },
      /**
       * #slot
       * `content` is the fraction of bases that are G or C, in [0, 1];
       * `skew` is (G - C) / (G + C), in [-1, 1]
       */
      op: {
        type: 'stringEnum',
        model: types.enumeration('GC op', ['content', 'skew']),
        defaultValue: 'content',
        description: 'GC content fraction, or GC skew (G-C)/(G+C)',
      },
      /**
       * #slot
       * bp each score is computed over, centered on the bin it is drawn as. A
       * step wider than the window widens it to the step, so every base is
       * scored. 1 scores single bases; wider windows smooth the signal
       */
      window: {
        type: 'number',
        defaultValue: WINDOW_DEFAULT,
        description: 'bp each score is computed over',
      },
      /**
       * #slot
       * bp between successive scores, or `"auto"` to follow the zoom: the
       * largest 1/2/5 rung (1, 2, 5, 10, 20, ... bp) at or under one point per
       * pixel at the display's resolution. A step under the window overlaps
       * the windows for a smoother signal
       */
      step: {
        type: 'number',
        model: types.union(types.number, types.literal(AUTO_STEP)),
        defaultValue: AUTO_STEP,
        description: 'bp between scores, or "auto" to follow the zoom',
      },
    },
    {
      explicitlyTyped: true,
      closed: true,
      retired: {
        windowSize: window => ({ window }),
        windowDelta: step => ({ step }),
      },
    },
  )
}

export type GCContentAdapterConfig = Instance<
  ReturnType<typeof GCContentAdapterF>
>
export default GCContentAdapterF
