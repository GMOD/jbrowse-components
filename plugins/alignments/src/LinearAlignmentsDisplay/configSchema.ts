import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import { ARC_COLOR_TYPES } from '../shared/arcColorOptions.ts'
import { isRegisteredColorScheme } from '../shared/colorSchemes.ts'
import { defaultFilterFlags } from '../shared/util.ts'
import {
  LINKED_READS_MODES,
  READ_CONNECTIONS_MODES,
  SASHIMI_ARCS_MODES,
} from './constants.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearAlignmentsDisplay
 * #category display
 * configuration schema for the LinearAlignmentsDisplay
 *
 * #example
 * Minimal BAM track — no display override needed for defaults. See the
 * [alignments track guide](/docs/config_guides/alignments_track) for all
 * adapter and display options:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs_reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
 * }
 * ```
 *
 * #example
 * CRAM colored by CpG methylation (modBAM MM/ML tags). The `displayDefaults`
 * object shorthand applies settings without spelling out the display `type` or
 * `displayId` — equivalent to `displays: [{ type: 'LinearAlignmentsDisplay',
 * displayId: '...', colorBy: ... }]`. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'methylation',
 *   name: 'Methylation',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
 *   displayDefaults: {
 *     colorBy: { type: 'modifications', modifications: { fillUnmarked: true } },
 *   },
 * }
 * ```
 *
 * #example
 * Long reads — taller track, soft-clipping shown, split/chimeric reads
 * connected by arcs:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'long_reads',
 *   name: 'Long reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
 *   displayDefaults: {
 *     height: 400,
 *     showSoftClipping: true,
 *     linkedReads: 'normal',
 *     readConnections: 'arc',
 *   },
 * }
 * ```
 */
export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot
       */
      // The single "compactness" axis. Spacing between reads is derived from
      // this (`featureSpacingForHeight`), not stored — the presets (7/3/1) and
      // the fit-mode squeeze all key off this one value.
      featureHeight: {
        type: 'maybeNumber',
        description:
          'Height of each feature (read) in pixels. Unset (the default) follows the session-wide default for this display type, falling back to 7; an explicit number customizes the track (including customizing 7 back over a compact session default)',
        // Sentinel promotable slot (like heightMode): `undefined` is the inherit
        // state, `promotedBase` (7) is what it resolves to when nothing is
        // promoted. A plain `number` slot would spend its default value (7 =
        // Normal) as the inherit signal, so a track could not pin Normal back
        // over a session-wide Compact default — clicking Normal would strip to
        // default and re-inherit Compact. See promotableDefaults.ts.
        promotedBase: 7,
      },
      // `growMaxHeight` rides along, so both of `HeightModeMixin`'s slots are
      // declared here at once. It is NOT the `maxHeight` layout cap below.
      ...heightModeConfigSchemaFields({
        heightMode:
          'Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps `featureHeight` and scrolls; `grow` expands the track to show every read at the configured height; `fit` squeezes reads so every uncollapsed group fills the display without scrolling. Orthogonal to the per-read size set by `featureHeight`',
        growMaxHeight:
          'Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see maxHeight)',
      }),
      /**
       * #slot
       */
      readConnectionsLineWidth: {
        type: 'number',
        defaultValue: 1,
        description: 'Line width for read-connection arcs/lines in pixels',
      },
      /**
       * #slot
       */
      showSashimiLabels: {
        type: 'maybeBoolean',
        description: 'Draw the supporting-read count on each sashimi arc',
        // `undefined` is the inherit sentinel and `promotedBase` the value it
        // resolves to, so a track can pin labels OFF over a promoted ON — a
        // plain boolean would spend its `false` default on the inherit signal
        // and silently re-inherit ON. Read through the resolved
        // `showSashimiLabels` getter (resolveConf), never raw.
        promotedBase: false,
      },
      /**
       * #slot
       */
      hideNonCanonicalJunctions: {
        type: 'maybeBoolean',
        description:
          'Hide sashimi arcs whose splice-site motif is none of GT-AG, GC-AG or AT-AC. Read off the reference under each junction, so it needs a sequence adapter; a junction whose motif could not be read stays',
        // Promotable like the sibling sashimi settings: `undefined` inherits,
        // `promotedBase` is what it resolves to. Read through the resolved
        // `hideNonCanonicalJunctions` getter (resolveConf), never raw.
        promotedBase: false,
      },
      /**
       * #slot
       */
      // NOT the grow ceiling (`growMaxHeight`, above). This caps how much is
      // laid out; that caps how tall `grow` mode sizes the track. Two different
      // limits, don't conflate them.
      maxHeight: {
        type: 'number',
        defaultValue: 6000,
        description:
          'Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)',
        advanced: true,
      },
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 250,
        description:
          'Starting height in pixels for the coverage band and pileup together; heightMode decides what a pileup deeper than this does',
      },
      /**
       * #slot
       */
      colorBy: {
        type: 'maybeFrozen',
        // Promotable sentinel slot (see promotableDefaults.ts / displayMode):
        // unset is the inherit state, `promotedBase` (`{ type: 'normal' }`) is
        // what it resolves to when nothing is promoted — so every real scheme,
        // `normal` included, is customizable over an opposite session-wide
        // default (picking "Normal" customizes to normal, exactly as picking
        // "Fixed" customizes the heightMode base). Nothing has to invent a
        // non-scheme `.type` for the inherit state, so `validate` only ever sees
        // a real candidate and every read goes through the resolved `colorBy`
        // getter (resolveConf). Legacy stored schemes stay valid values (customized),
        // so no snapshot migration is needed.
        promotedBase: { type: 'normal' },
        // Reject a `.type` that isn't (or no longer is) a registered scheme —
        // whether customized on this track or promoted session-wide — so a
        // stale/renamed scheme name in a saved session degrades to "not usable"
        // (falls back to the base) instead of reaching the total COLOR_SCHEMES
        // lookups and crashing color-by resolution.
        validate: isRegisteredColorScheme,
        description: 'Color scheme for reads',
        advanced: true,
      },
      /**
       * #slot
       * default filter flags is exclude 1540
       * read unmapped (0x4)
       * read fails platform/vendor quality checks (0x200)
       * read is PCR or optical duplicate (0x400)
       */
      filterBy: {
        type: 'frozen',
        defaultValue: defaultFilterFlags,
        description: 'Filter settings for reads',
        advanced: true,
      },
      /**
       * #slot
       */
      groupBy: {
        type: 'frozen',
        defaultValue: null,
        description:
          'In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)',
        advanced: true,
      },
      /**
       * #slot
       * Only consulted while `groupBy` is in effect. Collapsing trades the
       * per-group stack for one lane per group, with overlap depth carried by
       * the tint shading instead of by row count — the compact reading for a
       * track with many groups (an all-vs-all synteny track's mate genomes). A
       * group expanded from its label chip opts back out and draws a true stack.
       */
      collapseGroupRows: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw each group as a single row rather than a stack',
      },
      /**
       * #slot
       */
      autoscale: {
        type: 'stringEnum',
        model: types.enumeration('Coverage autoscale type', [
          'local',
          'localsd',
        ]),
        defaultValue: 'local',
        description: 'Coverage autoscale type',
      },
      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'Minimum coverage depth bound',
        advanced: true,
      },
      /**
       * #slot
       */
      maxScore: {
        type: 'number',
        defaultValue: Number.MAX_VALUE,
        description: 'Maximum coverage depth bound',
        advanced: true,
      },
      /**
       * #slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Coverage scale type', [
          'linear',
          'log',
          'symlog',
        ]),
        defaultValue: 'linear',
        description:
          'Coverage scale type. "log" floors the domain at a depth of 1, which draws a single-read position at the same height as no coverage at all; "symlog" is log-like higher up and linear through zero, so low depths stay separable',
      },
      /**
       * #slot
       */
      symlogConstant: {
        type: 'number',
        defaultValue: 1,
        description:
          'Width of symlog\'s linear region around zero, in depth units. The default 1 makes symlog exactly log(depth+1), which is the transform read depth wants: the knee sits at one read, the smallest depth there is. 0 means "derive from the domain" (a thousandth of the visible max) — right for a wiggle track, whose units are its own, and wrong here, since it puts the knee a tenth of a read below zero and draws a single stray read a third of the way up a depth-100 band',
        advanced: true,
      },
      /**
       * #slot
       */
      numStdDev: {
        type: 'number',
        defaultValue: 3,
        description: 'Number of standard deviations for localsd autoscale',
        advanced: true,
      },
      /**
       * #slot
       */
      mismatchAlpha: {
        type: 'maybeBoolean',
        description:
          'Fade mismatch bases by their per-base Phred quality. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default)',
        // Promotable via the `maybeBoolean` sentinel: `undefined` (unset) is the
        // inherit state, `promotedBase` (false) is what it resolves to when
        // nothing is promoted. A legacy stored boolean is already a valid
        // customized value, so no snapshot migration is needed. Read through the resolved
        // `mismatchAlpha` getter (resolveConf), never raw.
        promotedBase: false,
      },
      /**
       * #slot
       */
      showLowFreqMismatches: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Draw sub-pixel mismatches, insertions and clip bars in the pileup at full opacity instead of fading the ones below the depth-dependent frequency threshold. Read through the `filterMismatchesByFrequency` getter, which is this in the polarity the renderers and hit-test take. Does not affect the coverage band (see runCoveragePipeline)',
        advanced: true,
      },
      /**
       * #slot
       */
      showLegend: {
        type: 'maybeBoolean',
        description:
          'Show the color-scheme legend overlay. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default)',
        // Promotable via the `maybeBoolean` sentinel: `undefined` (unset) is the
        // inherit state, `promotedBase` (false) is what it resolves to when
        // nothing is promoted. A legacy stored boolean is already a valid
        // customized value, so no snapshot migration is needed. Read through the
        // resolved `showLegend` getter (resolveConf), never raw.
        promotedBase: false,
      },
      /**
       * #slot
       */
      sortedBy: {
        type: 'frozen',
        defaultValue: null,
        description:
          'Sort reads at a genomic position, e.g. by base, strand, or a tag (null = unsorted)',
        advanced: true,
      },
      /**
       * #slot
       * Lay out the widest features in the lowest pileup rows instead of by
       * genomic start, so large alignments cluster at the top rather than
       * interleaving with small ones. Off by default; LGVSyntenyDisplay turns
       * it on. Ignored while an explicit `sortedBy` position sort is active.
       */
      largeFeaturesFirst: {
        type: 'boolean',
        defaultValue: false,
        description: 'Lay out large features first, in the lowest pileup rows',
      },
      /**
       * #slot
       * The other layout-order flag, for RNA-seq: reads whose CIGAR carries a
       * skip take the lowest rows. Ignored while a `sortedBy` position sort is
       * active; wins over `largeFeaturesFirst` if both are set.
       */
      splicedReadsFirst: {
        type: 'boolean',
        defaultValue: false,
        description: 'Lay out spliced reads first, in the lowest pileup rows',
      },
      /**
       * #slot
       * null = auto: outline is drawn only in chain/linked-read modes. Set
       * true/false to force it on or off regardless of mode.
       */
      showOutline: {
        type: 'frozen',
        defaultValue: null,
        description: 'Draw an outline around each read (null = auto by mode)',
        advanced: true,
      },
      /**
       * #slot
       */
      linkedReads: {
        type: 'maybeStringEnum',
        model: types.enumeration('LinkedReadsMode', [...LINKED_READS_MODES]),
        // Promotable sentinel slot (like heightMode): unset is the inherit
        // state, resolving to the session-wide default for this display type,
        // falling back to `promotedBase` ('off'). Being a sentinel lets a track
        // customize `off` back over a session-wide `normal` (view-as-pairs) default.
        // See promotableDefaults.ts.
        promotedBase: 'off',
        // Chains by QNAME — mates plus supplementary (split) segments onto one
        // row. NOT a linked-read barcode (BX/MI) grouping, which this has never
        // done and which the old wording ('barcode-chain') sent readers looking
        // for. The menu row is "View as pairs / link supplementary alignments".
        description:
          'View as pairs / link supplementary alignments: put a read, its mate and its split segments on one row',
      },
      /**
       * #slot
       */
      showBezierConnections: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw paired-read connection curves over the pileup',
      },
      /**
       * #slot
       */
      showCoverage: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw the coverage histogram band',
      },
      /**
       * #slot
       */
      showPileup: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw the stacked-read pileup band',
      },
      /**
       * #slot
       */
      coverageHeight: {
        type: 'number',
        defaultValue: 45,
        description: 'Height of the coverage band in pixels',
      },
      /**
       * #slot
       */
      coverageSnpMinFrequency: {
        type: 'number',
        defaultValue: 0,
        description:
          "Hide a coverage-band allele segment whose share of that position's depth is below this fraction, so the band stops painting a sliver for every sequencing error at high depth. 0 (the default) colors every mismatch. Distinct from `showLowFreqMismatches`, which turns OFF the pileup's fade of sub-pixel marks against a depth-dependent threshold; this is a flat allele-fraction floor on the band, and the grey depth bar still shows through where a segment is hidden",
        advanced: true,
      },
      /**
       * #slot
       */
      showMismatches: {
        type: 'boolean',
        defaultValue: true,
        description:
          'Draw how reads differ from the reference: per-base mismatches, insertion markers and deletion bars. Not the intron centerlines — a spliced read is drawn as separate exon blocks, so the line joining them says they are one read rather than several, and it draws either way (PILEUP_LAYERS)',
      },
      /**
       * #slot
       */
      showInterbaseIndicators: {
        type: 'boolean',
        defaultValue: true,
        description:
          'Draw interbase insertion/clip count bars and indicator triangles',
      },
      /**
       * #slot
       */
      drawSingletons: {
        type: 'boolean',
        defaultValue: true,
        // The filter is `filterChainFeatures`, which drops QNAME chains of ONE:
        // reads whose mate AND whose supplementary segments are all absent from
        // the view. An unmapped mate (flag 0x8) is a different question and this
        // slot has never asked it — the menu helpText already said so.
        description:
          'Draw reads whose mate and split/supplementary segments are all absent from the view (samtools "singletons")',
      },
      /**
       * #slot
       */
      drawProperPairs: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw properly-paired reads',
      },
      /**
       * #slot
       */
      showOnlySplitAlignments: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Only draw reads that are part of a split/chimeric alignment (have a supplementary segment, SAM flag 0x800)',
      },
      /**
       * #slot
       */
      flipStrandLongReadChains: {
        type: 'boolean',
        defaultValue: true,
        // Named for what it did when it framed each chain against its own
        // primary. It now frames every chain against the orientation the chains
        // on screen agree on (`consensusChainStrandFrames`) — the slot name is
        // kept because sessions and configs in the wild carry it, and it still
        // answers the same question: is a split segment coloured by its own
        // mapping strand, or relative to the rest of its molecule.
        description:
          'Color split segments relative to the predominant orientation of the reads on screen, rather than by their own mapping strand',
      },
      /**
       * #slot
       */
      colorSupplementaryChains: {
        type: 'boolean',
        defaultValue: false,
        // Not paired-only: `readColorCategory` puts this override above both the
        // paired and the unpaired split classifiers deliberately (5b8aa129d9 had
        // scoped it to pairs, which made the tickbox a no-op on long reads).
        description:
          'Paint every chain carrying a supplementary segment a flat supplementary color, paired or not',
      },
      /**
       * #slot
       */
      drawInter: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw inter-chromosomal read-connection arcs',
      },
      /**
       * #slot
       */
      drawProperPairArcs: {
        type: 'boolean',
        // "Concordant" here is `isConcordantPairRead`, the same rule the
        // `drawProperPairs` READ filter uses — that setting hides the reads,
        // this one hides their arcs. Default true, so the band is unchanged
        // until asked.
        defaultValue: true,
        description:
          'Draw arcs for ordinary concordant pairs. Uncheck to leave only the arcs that carry a category (abnormal insert size or orientation, split junctions), which on deep coverage is the difference between a readable band and a solid mass',
      },
      /**
       * #slot
       */
      minInterchromSupport: {
        type: 'number',
        // Reads are counted over a window of one fragment length on BOTH sides,
        // not at a coordinate — a mate-pair breakpoint is not localized to a
        // base. See `clusteredInterchromSupport`. 1 draws every connection.
        defaultValue: 2,
        description:
          'Hide inter-chromosomal connections supported by fewer than this many reads clustered at the same breakpoint',
      },
      /**
       * #slot
       */
      drawLongRange: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw long-range read-connection arcs',
      },
      /**
       * #slot
       */
      arcColorByType: {
        type: 'stringEnum',
        model: types.enumeration('ArcColorByType', [...ARC_COLOR_TYPES]),
        defaultValue: 'insertSizeAndOrientation',
        description: 'How to color read-connection arcs',
      },
      /**
       * #slot
       */
      readConnections: {
        type: 'maybeStringEnum',
        model: types.enumeration('ReadConnectionsMode', [
          ...READ_CONNECTIONS_MODES,
        ]),
        // Promotable sentinel slot: unset follows the session-wide default
        // (else `promotedBase` 'off'), and a track can pin `off` back over a
        // session-wide `arc` default. See promotableDefaults.ts.
        promotedBase: 'off',
        description:
          'Read-connection rendering mode (mate pairs + split reads)',
      },
      /**
       * #slot
       */
      readConnectionsDown: {
        type: 'maybeBoolean',
        description:
          'Draw read connections below the coverage band. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (either direction, including drawing above the coverage band over an on session default)',
        // Promotable via the `maybeBoolean` sentinel (like showSoftClipping):
        // `undefined` (unset) is the inherit state, `promotedBase` (true) is what
        // it resolves to when nothing is promoted. The plain-boolean form could
        // never promote `false` (draw above coverage) because `defaultValue`
        // doubled as the inherit signal. Read through the resolved
        // `readConnectionsDown` getter (resolveConf), never raw.
        promotedBase: true,
      },
      /**
       * #slot
       */
      showSashimiArcs: {
        type: 'maybeBoolean',
        // Promotable sentinel like the two sashimi settings it gates: `undefined`
        // is the inherit signal and `promotedBase` the value it resolves to, so a
        // track can pin arcs OFF over a session-wide ON. It was the one control
        // in its own submenu with no pin — "show sashimi arcs by default for
        // every track" was the single thing the menu couldn't express. Read
        // through the resolved `showSashimiArcs` getter (resolveConf), never raw.
        promotedBase: true,
        description: 'Draw sashimi (splice-junction) arcs',
      },
      /**
       * #slot
       */
      sashimiArcsMode: {
        type: 'maybeStringEnum',
        model: types.enumeration('SashimiArcsMode', [...SASHIMI_ARCS_MODES]),
        // Promotable sentinel slot (like linkedReads/readConnections): unset
        // follows the session-wide default (else `promotedBase` 'up'), and a
        // track can pin 'up' back over a session-wide 'down'/'auto' default.
        promotedBase: 'up',
        description: 'Sashimi junction-arc placement',
      },
      /**
       * #slot
       */
      minSashimiScore: {
        type: 'number',
        // Hides single-read junctions; set 0 to show every arc. Spelled as a
        // literal, not DEFAULT_MIN_SASHIMI_SCORE: the config docgen renders this
        // default by reading the AST node's source text, so a constant reference
        // publishes the identifier name instead of the value. Keep the two in
        // step — `constants.ts` names the same number for the menu's reset.
        defaultValue: 2,
        description:
          'Hide sashimi arcs with fewer than this many supporting reads',
      },
      /**
       * #slot
       */
      sashimiArcsHeight: {
        type: 'number',
        defaultValue: 40,
        description: 'Height of the sashimi-arc band in pixels',
      },
      /**
       * #slot
       */
      readConnectionsHeight: {
        type: 'number',
        // Arcs scale to whatever band they get, so this only buys apex
        // separation between insert sizes. It was dropped to 25 alongside the
        // per-section reservation, but that reservation is what fixed the
        // grouped stack — a lane drawing no arcs now gets no band at all, so
        // only the lanes that use the height pay for it, and at 25 the arcs
        // were too flat to separate. Kept above the 20px drag floor
        // (clampBandHeight).
        defaultValue: 35,
        description: 'Height of the read-connection band in pixels',
      },
      /**
       * #slot
       */
      showSoftClipping: {
        type: 'maybeBoolean',
        description:
          'Draw soft-clipped read portions. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default)',
        // Promotable via the `maybeBoolean` sentinel: `undefined` (unset) is the
        // inherit state, `promotedBase` (false) is what it resolves to when
        // nothing is promoted. A legacy stored boolean is already a valid
        // customized value, so no snapshot migration is needed. Read through the resolved
        // `showSoftClipping` getter (resolveConf), never raw.
        promotedBase: false,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearAlignmentsDisplayConfigSchema = ReturnType<
  typeof configSchemaFactory
>

export type LinearAlignmentsDisplayConfigModel =
  Instance<LinearAlignmentsDisplayConfigSchema>
