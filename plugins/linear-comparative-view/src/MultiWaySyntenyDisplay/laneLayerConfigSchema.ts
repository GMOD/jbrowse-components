import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { markListSchema } from '@jbrowse/plugin-marks'

/**
 * #config MultiWayLaneLayer
 * #category display
 * One row of data drawn in every lane through that lane's own frame, from
 * each genome's own track, on one value scale shared by every lane.
 *
 * #example
 * GC percent as bars above every lane's genes, from each genome's UCSC
 * gc5Base bigWig added as a track:
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   displayId: 'hg38_liftover_multiway-MultiWaySyntenyDisplay',
 *   laneLayers: [
 *     {
 *       name: 'GC %',
 *       tracks: ['hg38-gc5Base', 'panTro6-gc5Base', 'mm39-gc5Base'],
 *       marks: [{ mark: 'bar', encoding: { y: 'score' } }],
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * GC content computed from each genome's own sequence, one entry for every
 * lane, a hub star's lanes on genomes the session lacks included:
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   displayId: 'hg38_liftOver_multiway-MultiWaySyntenyDisplay',
 *   laneLayers: [
 *     {
 *       name: 'GC',
 *       adapter: { type: 'GCContentAdapter', windowSize: 1000, windowDelta: 1000 },
 *       marks: [{ mark: 'bar', encoding: { y: 'score' } }],
 *     },
 *   ],
 * }
 * ```
 */
export const laneLayerConfigSchema = ConfigurationSchema(
  'MultiWayLaneLayer',
  {
    /**
     * #slot name
     */
    name: {
      type: 'string',
      defaultValue: '',
      description: "what the layer's band is labelled",
    },
    /**
     * #slot tracks
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "the trackId each lane draws the layer from, one per genome, matched to a lane by the track's assembly. A lane no entry names draws an empty band",
    },
    /**
     * #slot adapter
     */
    adapter: {
      type: 'maybeFrozen',
      defaultValue: undefined,
      description:
        "an adapter computing from the sequence, such as `{ type: 'GCContentAdapter' }`, that every lane `tracks` names nothing for reads through its own genome. A lane reads it only while its window is under 5 Mb, since that window is the sequence it downloads, and the band's title says to zoom in past that",
    },
    /**
     * #slot height
     */
    height: {
      type: 'number',
      defaultValue: 24,
      description: 'px of band the layer takes in each lane',
    },
    /**
     * #slot marks
     * The mark display's marks, drawn over each lane's features. A lane is
     * drawn at up to 80 times the anchor's bp per px, so a `count` or `sum`
     * over an `auto` bin covers more bp on a zoomed-out lane and reads denser
     * under the shared scale; a mean such as a bigWig's `score` compares
     */
    marks: markListSchema([{ mark: 'bar', encoding: { y: 'score' } }]),
  },
  { closed: true },
)
