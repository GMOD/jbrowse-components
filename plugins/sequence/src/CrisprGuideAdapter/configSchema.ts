import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config CrisprGuideAdapter
 * #trackType FeatureTrack
 *
 * Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
 * track is displayed against. Setting it by hand pins the scan to one sequence
 * source and silently desyncs the track if the assembly's sequence changes.
 *
 * #example
 * The defaults are SpCas9 — `NGG` PAM, 20 nt guide, 3' PAM — and the adapter
 * scans the assembly's own sequence, which is why there is no file location.
 * A PAM occurs every few bases, so an unfiltered scan is denser than a display
 * can draw; the GC window and `excludePolyT` (guides carrying `TTTT`, a
 * terminator for the pol III promoters guides are expressed from) keep the
 * usable ones. SaCas9 is the same track with `pam: 'NNGRRT'` and
 * `guideLength: 21`:
 * ```js
 * {
 *   type: 'CrisprGuideAdapter',
 *   pam: 'NGG',
 *   guideLength: 20,
 *   pamLocation: '3prime',
 *   cutOffset: 3,
 *   minGcPercent: 40,
 *   maxGcPercent: 60,
 *   excludePolyT: true,
 * }
 * ```
 *
 * #example a different nuclease
 * Cas12a/Cpf1 reads a `TTTV` PAM at the 5' end with a longer guide, and cuts
 * far from the PAM — so `pamLocation` and both cut offsets move too, or the
 * guides are found in the right places and drawn cutting in the wrong ones:
 * ```js
 * {
 *   type: 'CrisprGuideAdapter',
 *   pam: 'TTTV',
 *   pamLocation: '5prime',
 *   guideLength: 23,
 *   cutOffset: 18,
 *   cutOffsetBottom: 23,
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'CrisprGuideAdapter',
  {
    /**
     * #slot
     * discouraged: leave unset. JBrowse supplies the assembly's sequence
     * adapter automatically; this override exists only for the rare case of
     * scanning a sequence other than the one the track is displayed against.
     */
    sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    },
    /**
     * #slot
     * PAM motif in IUPAC codes, e.g. NGG for SpCas9, TTTV for Cas12a
     */
    pam: {
      type: 'string',
      defaultValue: 'NGG',
    },
    /**
     * #slot
     * protospacer length in bp
     */
    guideLength: {
      type: 'number',
      defaultValue: 20,
    },
    /**
     * #slot
     * whether the PAM is 3' (Cas9) or 5' (Cas12a) of the protospacer
     */
    pamLocation: {
      type: 'stringEnum',
      model: types.enumeration('PamLocation', ['3prime', '5prime']),
      defaultValue: '3prime',
    },
    /**
     * #slot
     * distance in bp from the PAM-proximal end of the protospacer to the cut on
     * the protospacer-matching strand (3 for SpCas9, 18 for Cas12a)
     */
    cutOffset: {
      type: 'number',
      defaultValue: 3,
    },
    /**
     * #slot
     * same, for the cut on the opposite strand. Equal to `cutOffset` for a blunt
     * cutter like SpCas9; larger for a staggered one like Cas12a (23), whose two
     * cuts leave a 5' overhang.
     */
    cutOffsetBottom: {
      type: 'number',
      defaultValue: 3,
    },
    /**
     * #slot
     * drop guides below this GC percent. A PAM occurs every ~8bp of genome, so
     * an unfiltered scan is far denser than a display can draw; the defaults
     * keep everything and leave the choice to the caller.
     */
    minGcPercent: {
      type: 'number',
      defaultValue: 0,
    },
    /**
     * #slot
     * drop guides above this GC percent
     */
    maxGcPercent: {
      type: 'number',
      defaultValue: 100,
    },
    /**
     * #slot
     * drop guides containing TTTT, which terminates transcription from the pol
     * III (U6/H1) promoters guides are usually expressed from
     */
    excludePolyT: {
      type: 'boolean',
      defaultValue: false,
    },
    /**
     * #slot
     * whether to scan the forward strand for PAMs
     */
    searchForward: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     * whether to scan the reverse strand for PAMs
     */
    searchReverse: {
      type: 'boolean',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export type CrisprGuideAdapterConfig = Instance<typeof configSchema>

export default configSchema
