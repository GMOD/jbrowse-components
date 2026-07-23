import { COMPACTNESS_PRESETS } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/compactnessPresets.ts'
import { COLOR_SCHEMES } from '../../../../plugins/alignments/src/shared/colorSchemes.ts'
import { GENE_GLYPH_MODE_OPTIONS } from '../../../../plugins/canvas/src/LinearBasicDisplay/geneGlyphMode.ts'
import { getHeightModeOptions } from '../../../../plugins/linear-genome-view/src/BaseLinearDisplay/models/heightMode.ts'
import {
  MULTI_WIGGLE_RENDERING_GROUPS,
  WIGGLE_RENDERINGS,
} from '../../../../plugins/wiggle/src/renderingTypes.ts'

// Maps a session-spec field to the thing a reader would actually click. Every
// menu label here is either imported from the plugin's own option registry
// (so it cannot drift from the menu) or verified against the menu source; a
// field with no verified path is deliberately absent rather than guessed —
// `pnpm check-spec-recipes` lists those, and the spec JSON shown alongside is
// always complete regardless.
//
// A step describes the *action*, not the demo data: the reader is doing this to
// their own file, and the figure's value is shown only as the worked example.

export interface FieldStep {
  // click path through the UI, e.g. "Track menu → Color by... → Paired end"
  path: string
  // what the setting does, when the label alone doesn't say it
  note?: string
}

// Some labels name what the track holds ('Fixed read height' vs 'Fixed feature
// height'), so a recipe passes the singular noun for the track it is describing.
export interface FieldContext {
  noun: string
}

export type FieldRecipe = (
  value: unknown,
  context: FieldContext,
) => FieldStep | undefined

const TRACK_MENU = 'Track menu'

// A spec field's value is whatever JSON the link carried, so it is narrowed
// rather than asserted — an unexpected shape yields no step (and gets reported
// as unmapped) instead of a wrong instruction.
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function colorByStep(value: unknown): FieldStep | undefined {
  const colorBy = asRecord(value)
  const type = asString(colorBy?.type)
  // matched by value rather than keyed, so no cast into ColorSchemeType is
  // needed to look up a scheme named by arbitrary JSON
  const scheme = Object.values(COLOR_SCHEMES).find(s => s.type === type)
  if (!scheme) {
    return undefined
  }
  const { menu } = scheme
  const inPairedEnd = menu.kind === 'radio' && menu.group === 'pairedEnd'
  const path = [
    TRACK_MENU,
    'Color by...',
    ...(inPairedEnd ? ['Paired end'] : []),
    menu.label,
  ].join(' → ')
  const tag = asString(colorBy?.tag)
  return {
    path: tag ? `${path} → enter tag "${tag}"` : path,
    note:
      scheme.type === 'modifications'
        ? 'Needs MM/ML modification tags in your BAM/CRAM.'
        : undefined,
  }
}

function geneGlyphStep(value: unknown): FieldStep | undefined {
  const option = GENE_GLYPH_MODE_OPTIONS.find(o => o.value === value)
  return option
    ? { path: `${TRACK_MENU} → Gene glyph mode → ${option.label}` }
    : undefined
}

// values from SUBFEATURE_LABEL_OPTIONS in the canvas display's model.ts, which
// doesn't export them ('none' reads as "Off" in the menu)
const SUBFEATURE_LABELS: Record<string, string> = {
  none: 'Off',
  below: 'Below',
  overlay: 'Overlay',
}

// getFeatureHeightMenuItem titles its submenu after what the track holds
const heightMenu = (noun: string) =>
  `${TRACK_MENU} → ${noun.charAt(0).toUpperCase()}${noun.slice(1)} height`

const SASHIMI_PLACEMENT: Record<string, string> = {
  auto: 'Auto (minimize overlap)',
  above: 'Above coverage',
  below: 'Below coverage',
}

const READ_CONNECTIONS: Record<string, string> = {
  arc: 'Arcs',
  cloud: 'Read cloud',
}

// verified against the inline radio list in makeSummaryScoreModeSubMenu
// (plugins/wiggle/src/shared/wiggleMenuItems.tsx)
const SUMMARY_SCORE_MODES: Record<string, string> = {
  min: 'Minimum',
  max: 'Maximum',
  avg: 'Average',
  whiskers: 'Whiskers',
}

// The 'Plot type' menu radios come straight from the two exported wiggle tables,
// so single vs multi-row wording can't drift from the menu.
function renderingTypeStep(value: unknown): FieldStep | undefined {
  const single = WIGGLE_RENDERINGS.find(([v]) => v === value)
  if (single) {
    return { path: `${TRACK_MENU} → Plot type → ${single[1]}` }
  }
  for (const [group, options] of MULTI_WIGGLE_RENDERING_GROUPS) {
    const opt = options.find(([v]) => v === value)
    if (opt) {
      return { path: `${TRACK_MENU} → Plot type → ${group} → ${opt[1]}` }
    }
  }
  return undefined
}

function resolutionLabel(n: number) {
  return n >= 1 ? `${n}×` : `1/${Math.round(1 / n)}×`
}

const checkbox = (label: string, note?: string): FieldRecipe => {
  return value =>
    typeof value === 'boolean'
      ? {
          path: `${TRACK_MENU} → ${label} (${value ? 'checked' : 'unchecked'})`,
          note,
        }
      : undefined
}

const fromTable = (
  label: string,
  table: Record<string, string>,
): FieldRecipe => {
  return value => {
    const option = typeof value === 'string' ? table[value] : undefined
    return option ? { path: `${TRACK_MENU} → ${label} → ${option}` } : undefined
  }
}

const numberField =
  (build: (n: number) => FieldStep): FieldRecipe =>
  value =>
    typeof value === 'number' ? build(value) : undefined

export const trackFields: Record<string, FieldRecipe> = {
  colorBy: colorByStep,
  geneGlyphMode: geneGlyphStep,
  // the size presets carry their own pixel heights, so the figure's number
  // names its preset without a second table to keep in sync
  featureHeight: (value, { noun }) => {
    const preset = Object.values(COMPACTNESS_PRESETS).find(
      p => p.featureHeight === value,
    )
    return {
      path: preset
        ? `${heightMenu(noun)} → ${preset.label}`
        : `${heightMenu(noun)} → Custom... → ${String(value)}px`,
    }
  },
  // 'Track sizing' is a subheader inside the same submenu as the size presets
  heightMode: (value, { noun }) => {
    const option = getHeightModeOptions(noun).find(o => o.value === value)
    return option
      ? { path: `${heightMenu(noun)} → Track sizing → ${option.label}` }
      : undefined
  },
  height: numberField(() => ({
    path: 'Drag the bar at the bottom edge of the track to resize it.',
  })),
  subfeatureLabels: fromTable('Subfeature labels', SUBFEATURE_LABELS),
  sashimiArcsMode: fromTable('Sashimi arcs → Arc placement', SASHIMI_PLACEMENT),
  readConnections: fromTable('Read connections', READ_CONNECTIONS),
  showSoftClipping: checkbox(
    'Show... → Show soft clipping',
    'Reveals clipped bases — the signal that a read spans a breakpoint.',
  ),
  showOnlyGenes: checkbox('Show only genes'),
  showTranslation: checkbox('Show translation'),
  showSashimiLabels: checkbox('Sashimi arcs → Show labels'),
  readConnectionsDown: checkbox(
    'Read connections → Arc / read cloud band options → Draw arcs below coverage band',
  ),
  groupBy: value => {
    const tag = asString(asRecord(value)?.tag)
    return tag
      ? {
          path: `${TRACK_MENU} → Group by... → Tag... → enter "${tag}"`,
          note:
            tag === 'HP'
              ? 'HP is the haplotype tag written by phasing tools like WhatsHap or Longphase.'
              : undefined,
        }
      : undefined
  },
  minSashimiScore: numberField(n => ({
    path: `${TRACK_MENU} → Sashimi arcs → Filter by score → ${n}`,
    note: 'Hides splice junctions supported by fewer reads than this.',
  })),
  maxHeight: numberField(n => ({
    path: `${TRACK_MENU} → Show... → Set max layout height... → ${n}`,
  })),
  // Two inline sliders under the multi-sample variant "Filter by..." submenu
  // (labels verified in shared/multiSampleVariantMenuItems.ts). Both re-fetch
  // on release; a value of 0 (MAF) / 1 (missingness) turns the filter off.
  minorAlleleFrequencyFilter: numberField(n => ({
    path: `${TRACK_MENU} → Filter by... → Minor allele frequency → ${n.toFixed(2)}`,
    note: 'Hides variants whose minor allele frequency is below this.',
  })),
  maxMissingnessFilter: numberField(n => ({
    path: `${TRACK_MENU} → Filter by... → Missingness → ${n.toFixed(2)}`,
    note: 'Hides variants whose fraction of no-call genotypes is above this; 1 keeps every variant.',
  })),
  defaultRendering: renderingTypeStep,
  summaryScoreMode: fromTable(
    'Score → Summary score mode',
    SUMMARY_SCORE_MODES,
  ),
  showDescriptions: checkbox('Show... → Show descriptions'),
  resolution: numberField(n => ({
    path: `${TRACK_MENU} → Resolution → Finer / Coarser`,
    note: `Higher fetches finer bins. This figure uses ${resolutionLabel(n)}, stepped by 2× per click.`,
  })),
  minScore: numberField(n => ({
    path: `${TRACK_MENU} → Score → Set min/max score...`,
    note: `Sets the score-axis minimum (${n} here).`,
  })),
  maxScore: numberField(n => ({
    path: `${TRACK_MENU} → Score → Set min/max score...`,
    note: `Sets the score-axis maximum (${n} here).`,
  })),
  coverageHeight: numberField(() => ({
    path: 'Drag the bottom edge of the coverage band to resize it.',
  })),
  forceLoad: value =>
    value === true
      ? {
          path: 'Click Force load in the track\'s "Zoom in to see features or force load" message.',
          note: 'Loads the region even past the byte-size limit, which can be slow.',
        }
      : undefined,
}

const TRACK_LABELS: Record<string, string> = {
  overlapping: 'Overlapping',
  offset: 'Offset',
  hidden: 'Hidden',
}

export const viewFields: Record<string, FieldRecipe> = {
  showCenterLine: value =>
    typeof value === 'boolean'
      ? {
          path: `View menu → Show center line (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  trackLabels: value => {
    const option = typeof value === 'string' ? TRACK_LABELS[value] : undefined
    return option ? { path: `View menu → Track labels → ${option}` } : undefined
  },
  colorByCDS: value =>
    typeof value === 'boolean'
      ? {
          path: `View menu → Color by CDS and draw amino acids (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  drawCurves: value =>
    typeof value === 'boolean'
      ? {
          path: `Synteny view menu → Show curved lines (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  highlight: value =>
    Array.isArray(value)
      ? {
          path: 'View menu → Zoom to region / use the location box, then add a highlight',
          note: `This figure highlights ${value.length} region${value.length === 1 ? '' : 's'}; highlights can also be set with the &highlight= URL parameter.`,
        }
      : undefined,
}

// Fields that describe the figure itself rather than a setting the reader would
// reproduce — they get no step, and are not reported as gaps.
export const IGNORED_FIELDS = new Set([
  'type',
  'trackId',
  'assembly',
  'loc',
  'tracks',
  'views',
  'sessionTracks',
  'displayedRegionNames',
])
