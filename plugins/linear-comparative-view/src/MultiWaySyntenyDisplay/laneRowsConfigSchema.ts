import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { stringList } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { LANE_ROWS_SETTINGS } from './copyLane.ts'

/**
 * #config LaneRows
 * #category display
 * The multi-way synteny display's `rows`: a lane per genome, or with `field:
 * 'refName'` a lane per copy of the anchor window a genome holds. It is the
 * arrangement a reader gives the lanes, by name, and writing it changes only
 * the members stated. `sort` lists the lanes that stack first, in order, the
 * rest following densest-first so a ribbon chain through adjacent lanes is
 * cut as late as possible; among copy lanes the anchor's assembly named in
 * it stacks the anchor at that place, where otherwise it stacks first. `kept` names the
 * lanes drawn, empty drawing the track's lanes or every lane. Haplotype lanes
 * read off a graph follow by structure instead, below any lanes `sort` pins,
 * so lanes whose deletions and insertions against the anchor match sit
 * together, in an order worked out once per window. Lanes take no tree.
 *
 * #example
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   rows: {
 *     sort: ['GCF_000346465.2', 'poplar'],
 *     kept: ['GCF_000346465.2', 'poplar', 'citrus'],
 *     colors: { poplar: '#1b9e77' },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   rows: { field: 'refName', sort: ['{grape}chr9', 'peach', '{grape}chr11'] },
 * }
 * ```
 */
export const laneRowsConfigSchema = ConfigurationSchema(
  'LaneRows',
  {
    /**
     * #slot field
     * What one lane is: `assembly`, a lane per genome drawing the contig that
     * best explains the window, or `refName`, a lane per contig of a genome
     * holding a copy of the window, a polyploid's homoeologs or an old
     * duplication's ohnologs, each read against the anchor alone. A copy lane
     * is named as a locstring names a contig with its assembly,
     * `{grape}chr9`, and answers to its genome's name: a `labels` or
     * `colors` entry naming the genome reaches each of its copies, a `kept`
     * one keeps each copy unless `kept` names one of them, and a `sort` one
     * places the copies no other entry names. With genome lanes a copy named
     * in `kept` or `sort` stands for its genome, so switching keeps both. A
     * contig holding under a tenth of its genome's heaviest contig's evidence
     * draws no lane unless `kept` names it. The anchor's own contig draws no
     * lane; its genome's other contigs draw as copies. `auto` draws copy lanes
     * where the track's `assemblyNames` name at most one genome besides the
     * anchor, and genome lanes across more.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('LaneRowsField', [...LANE_ROWS_SETTINGS]),
      defaultValue: 'auto',
      description:
        "what one lane is: 'assembly', a lane per genome, or 'refName', a lane per contig holding a copy of the window, named '{<assembly>}<refName>' and answering to its genome's name; 'auto' draws 'refName' where the track names at most one genome besides the anchor, else 'assembly'",
    },
    /**
     * #slot sort
     * The lanes that stack first, by name, in this order; the rest follow
     * densest-first, or each beside the lane most alike where the source joins
     * neighbouring lanes. Among copy lanes, the anchor's assembly named here
     * stacks the anchor at that place.
     */
    sort: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "the lanes that stack first, by name, in this order; the rest follow densest-first, or each beside the lane most alike where the source joins neighbouring lanes; among copy lanes the anchor's assembly named here stacks the anchor there",
    },
    /**
     * #slot labels
     * A label drawn for a lane in place of its name, by lane
     * name. Where the lane labels draw is `labels.lanes`.
     */
    labels: {
      type: 'stringMap',
      defaultValue: {},
      description:
        'a label drawn for a lane in place of its name, by lane name; labels.lanes says where lane labels draw',
    },
    /**
     * #slot colors
     * A color pinned on a lane, by lane name, the anchor's included, over
     * the color its source declares for it: ggplot2's
     * `scale_*_manual(values = c(name = ...))`. It draws as a bar beside the
     * lane's label; a lane with neither draws none. A lane menu's Color...
     * writes it.
     */
    colors: {
      type: 'stringMap',
      defaultValue: {},
      description:
        "a color pinned on a lane, by lane name, the anchor's included, over the color its source declares; drawn as a bar beside the lane's label",
    },
    /**
     * #slot kept
     * The lanes drawn, by lane name: it selects rather than narrows,
     * replacing the track's lanes and able to add a lane the track does not
     * configure. Empty draws the track's lanes, or every lane where it
     * configures none.
     */
    kept: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "the lanes drawn, by lane name, selecting rather than narrowing: it replaces the track's lanes and can add one; empty draws the track's lanes, or every lane",
    },
  },
  {
    closed: true,
    plot: true,
    preProcessSnapshot: snap => ({
      ...snap,
      ...stringList(snap, 'sort', 'rows'),
      ...stringList(snap, 'kept', 'rows'),
    }),
  },
)
