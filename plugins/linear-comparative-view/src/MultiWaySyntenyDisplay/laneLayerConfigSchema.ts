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
 * gc5Base bigWig added as a track with the trackId `<genome>-gc5Base`:
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   displayId: 'hg38_liftover_multiway-MultiWaySyntenyDisplay',
 *   laneLayers: [
 *     {
 *       name: 'GC %',
 *       tracks: ['{assembly}-gc5Base'],
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
 *       adapter: { type: 'GCContentAdapter', window: 1000 },
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
      description: "label of the layer's band",
    },
    /**
     * #slot tracks
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "the trackIds the lanes draw the layer from, matched to a lane by the track's assembly. An entry spelling `{assembly}`, such as `{assembly}-gc5Base`, names in each lane the track whose id has that lane's genome, or any of its aliases, written there. Plain ids outrank `{assembly}` entries, and an earlier entry outranks a later one. A lane no entry names draws an empty band",
    },
    /**
     * #slot adapter
     */
    adapter: {
      type: 'maybeFrozen',
      holds: 'adapter',
      defaultValue: undefined,
      description:
        "an adapter computing from the sequence, such as `{ type: 'GCContentAdapter' }`, which each lane that `tracks` names nothing for reads through that lane's genome. A lane reads it only while its window is under 5 Mb, since that window is the sequence it downloads, and the band's title tells the reader to zoom in past that",
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
     * The mark display's marks, drawn over each lane's features; a mean such
     * as a bigWig's `score` compares across lanes, where a `count` or `sum`
     * reads denser on a zoomed-out lane.
     */
    marks: markListSchema([{ mark: 'bar', encoding: { y: 'score' } }]),
  },
  { closed: true },
)
