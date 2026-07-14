import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  HEIGHT_MODE_VALUES,
  baseLinearDisplayConfigSchema,
} from '@jbrowse/plugin-linear-genome-view'

import { isRegisteredColorScheme } from '../shared/colorSchemes.ts'
import { defaultFilterFlags } from '../shared/util.ts'

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
      // this (`featureSpacing` getter: height > 3 ? 1 : 0), not stored — the
      // presets (7/3/1) and the fit-mode squeeze all key off this one value.
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
        defaultValue: undefined,
        promotedBase: 7,
        promotable: true,
      },
      /**
       * #slot
       */
      heightMode: {
        type: 'stringEnum',
        model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
        description:
          'Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). `inherit` (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps `featureHeight` and scrolls; `grow` expands the track to show every read at the configured height; `fit` squeezes reads so every uncollapsed group fills the display without scrolling. Orthogonal to the per-read size set by `featureHeight`',
        // `inherit` is the CSS-style sentinel default (the inherit state);
        // `promotedBase` ('fixed') is what it resolves to when nothing is
        // promoted. Being a sentinel lets a track customize `fixed` back over a
        // session-wide `fit`/`grow` default. See promotableDefaults.ts.
        defaultValue: 'inherit',
        promotedBase: 'fixed',
        promotable: true,
      },
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
        type: 'boolean',
        defaultValue: false,
        description: 'Draw the supporting-read count on each sashimi arc',
        promotable: true,
      },
      /**
       * #slot
       */
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
      },
      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        // Sentinel promotable slot (see promotableDefaults.ts / displayMode):
        // `{ type: 'inherit' }` is the inherit/stripped state, `promotedBase`
        // (`{ type: 'normal' }`) is what it resolves to when nothing is promoted
        // — so every real scheme, `normal` included, is customizable over an opposite
        // session-wide default (picking "Normal" customizes to normal, exactly as picking
        // "Fixed" customizes the heightMode base). `inherit` is not a registered scheme
        // and never reaches a COLOR_SCHEMES lookup: isConcreteValue drops it
        // before `validate`, and every read goes through the resolved
        // `colorBy` getter (getConfResolved). Legacy stored schemes stay valid
        // members (customized values), so no snapshot migration is needed.
        defaultValue: { type: 'inherit' },
        promotedBase: { type: 'normal' },
        promotable: true,
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
        model: types.enumeration('Coverage scale type', ['linear', 'log']),
        defaultValue: 'linear',
        description: 'Coverage scale type (linear or log)',
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
        // `mismatchAlpha` getter (getConfResolved), never raw.
        defaultValue: undefined,
        promotedBase: false,
        promotable: true,
      },
      /**
       * #slot
       */
      showLowFreqMismatches: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Show low-frequency mismatches (below the SNP-calling threshold) in the coverage track',
      },
      /**
       * #slot
       */
      showLegend: {
        type: 'boolean',
        defaultValue: false,
        description: 'Show the color-scheme legend overlay',
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
        type: 'stringEnum',
        model: types.enumeration('LinkedReadsMode', [
          'inherit',
          'off',
          'normal',
        ]),
        // Sentinel promotable slot (like heightMode): `inherit` is the inherit
        // state, resolving to the session-wide default for this display type,
        // falling back to `promotedBase` ('off'). Being a sentinel lets a track
        // customize `off` back over a session-wide `normal` (view-as-pairs) default.
        // See promotableDefaults.ts.
        defaultValue: 'inherit',
        promotedBase: 'off',
        promotable: true,
        description: 'Linked-read (barcode-chain) layout mode',
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
      showMismatches: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw per-base mismatches on reads',
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
        description: 'Draw reads whose mate is unmapped',
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
      flipStrandLongReadChains: {
        type: 'boolean',
        defaultValue: true,
        description: 'Flip strand coloring for reverse long-read chains',
      },
      /**
       * #slot
       */
      colorSupplementaryChains: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Paint paired supplementary chains a flat supplementary color',
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
        model: types.enumeration('ArcColorByType', [
          'insertSizeAndOrientation',
          'insertSize',
          'orientation',
        ]),
        defaultValue: 'insertSizeAndOrientation',
        description: 'How to color read-connection arcs',
      },
      /**
       * #slot
       */
      readConnections: {
        type: 'stringEnum',
        model: types.enumeration('ReadConnectionsMode', [
          'inherit',
          'off',
          'arc',
          'samplot',
        ]),
        // Sentinel promotable slot: `inherit` follows the session-wide default
        // (else `promotedBase` 'off'), and a track can pin `off` back over a
        // session-wide `arc` default. See promotableDefaults.ts.
        defaultValue: 'inherit',
        promotedBase: 'off',
        promotable: true,
        description:
          'Read-connection rendering mode (mate pairs + split reads)',
      },
      /**
       * #slot
       */
      readConnectionsDown: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw read connections below the coverage band',
        promotable: true,
      },
      /**
       * #slot
       */
      showSashimiArcs: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw sashimi (splice-junction) arcs',
      },
      /**
       * #slot
       */
      sashimiArcsMode: {
        type: 'stringEnum',
        model: types.enumeration('SashimiArcsMode', [
          'inherit',
          'up',
          'down',
          'auto',
        ]),
        // Sentinel promotable slot (like linkedReads/readConnections): `inherit`
        // follows the session-wide default (else `promotedBase` 'up'), and a
        // track can pin 'up' back over a session-wide 'down'/'auto' default.
        defaultValue: 'inherit',
        promotedBase: 'up',
        promotable: true,
        description: 'Sashimi junction-arc placement',
      },
      /**
       * #slot
       */
      minSashimiScore: {
        type: 'number',
        defaultValue: 0,
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
        defaultValue: 40,
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
        // `showSoftClipping` getter (getConfResolved), never raw.
        defaultValue: undefined,
        promotedBase: false,
        promotable: true,
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

export type LinearAlignmentsDisplayConfigModel = Instance<
  ReturnType<typeof configSchemaFactory>
>
