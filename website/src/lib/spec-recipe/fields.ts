import { COMPACTNESS_PRESETS } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/compactnessPresets.ts'
import { COLOR_SCHEMES } from '../../../../plugins/alignments/src/shared/colorSchemes.ts'
import { cytosineContextOptions } from '../../../../plugins/alignments/src/shared/modificationData.ts'
import {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from '../../../../plugins/canvas/src/RenderFeatureDataRPC/featureColors.ts'
import { isJexl } from '../../../../packages/core/src/util/jexlStrings.ts'
// Straight from core, not through plugins/variants' re-export of it: that
// module pulls in variantTopBands.ts -> the whole plugins/canvas entrypoint ->
// BaseDisplayModel.tsx, and `node` cannot load a .tsx, so check-spec-recipes.ts
// died on ERR_UNKNOWN_FILE_EXTENSION before running a single check.
import { capitalizeFirst } from '../../../../packages/core/src/util/stringUtils.ts'
import { CONSERVATION_MODES } from '../../../../plugins/maf/src/LinearMafDisplay/conservationModes.ts'
import { DEFAULTS } from '../../../../plugins/maf/src/LinearMafDisplay/displayDefaults.ts'
import {
  CODON_ROW_RENDERING,
  ROW_RENDERINGS,
} from '../../../../plugins/maf/src/LinearMafDisplay/rowRenderings.ts'
import { GROUP_BY_LABELS } from '../../../../plugins/alignments/src/shared/groupByLabels.ts'
import { DEFAULT_AUTOSCALE_OPTIONS } from '../../../../packages/wiggle-core/src/autoscale.ts'
import { ARC_COLOR_OPTIONS } from '../../../../plugins/alignments/src/shared/arcColorOptions.ts'
import { ARC_DISPLAY_MODE_OPTIONS } from '../../../../plugins/arc/src/LinearArcDisplay/displayModes.ts'
import { CIGAR_MODE_OPTIONS } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyView/cigarModes.ts'
import { GENE_GLYPH_MODE_OPTIONS } from '../../../../plugins/canvas/src/LinearBasicDisplay/geneGlyphMode.ts'
import { SHOW_LABELS_OPTIONS } from '../../../../plugins/canvas/src/LinearBasicDisplay/showLabelsMode.ts'
import {
  DISPLAY_MODE_OPTIONS,
  SUBFEATURE_LABEL_OPTIONS,
} from '../../../../plugins/canvas/src/RenderFeatureDataRPC/displayModes.ts'
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
//
// Everything still in the gap report belongs to one of two third-party view
// types whose source is not in this repo: GraphGenomeView (`gfaLocation`,
// `colorDomain`, `bubbleSpread`) and protein3d's ProteinView (`uniprotId`,
// `transcriptId`, `connectedView`, `sideBySide`, `zoomToBaseLevel`, and its
// `height`). Their labels can be neither imported nor watched by the label check
// that covers plugins/, products/ and packages/, so a path written from them
// would drift with nothing to catch it. `transcriptId` additionally has no text
// input at all — the dialog offers an isoform dropdown built from the
// right-clicked feature, so no click sequence enters an accession. Leave them
// reported rather than hand-copying a label from a sibling checkout.
//
// `growMaxHeight` is reported for a third reason, and it is the one the Settings
// paragraph above forbids papering over: it is a config slot with no control at
// all. The size submenu's 'Track sizing' radios pick the MODE (`heightMode`);
// nothing in the UI edits the ceiling that mode grows to. A figure needs it when
// its own read height pushes the track past the 800px default, which is a spec
// concern rather than something a reader would click, so the honest answer is
// the JSON tab.
//
// The other way an entry lands in the report is a field several displays share
// on a track whose display type went unresolved, and the fix for that one is
// not here. Where only one display declares a field the name settles it, which
// is what isAlignmentsOnlyField and isHicOnlyField do; otherwise the display
// comes from `specDisplayType` — the spec's own `type` — falling back to the
// track config's sole declared display. A figure loading a hosted config has no
// track config to read at build time, so the spec has to name the display it
// means. Adding `type` to the spec entry is the fix, not a looser gate here:
// it is a no-op at render (`pickDisplayForView` takes the requested type first,
// and these all name what the track would have opened with anyway) and it is
// the only statement of intent a static script can trust.

export interface FieldStep {
  // click path through the UI, e.g. "Track menu → Color by... → Paired end"
  path: string
  // what the setting does, when the label alone doesn't say it
  note?: string
  // set when the path is how the view itself gets opened, which is otherwise a
  // step the recipe adds for it
  opensView?: boolean
}

// Some labels name what the track holds ('Fixed read height' vs 'Fixed feature
// height'), so a recipe passes the singular noun for the track it is describing.
export interface FieldContext {
  noun: string
  // The display the spec named, or undefined when it left the choice to the app
  // (see specDisplayType). Read by the recipes whose field names a different
  // menu on different displays — without it they can only be written for one
  // display and be silently wrong on the rest.
  displayType?: string
  // The view a viewFields recipe is describing. Same purpose one level up: a
  // field like colorBy means a different control on a synteny view than on any
  // other, and unlike a track entry a view always names its own type.
  viewType?: string
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

// A scheme's registry `menu.label` doubles as the text on its menu row only for
// `kind: 'radio'`. The three `kind: 'special'` schemes each open a submenu the
// registry spells differently — it names them for the legend, not the menu — so
// the "imported, cannot drift" guarantee covering the rest of this table stops
// here and these are verified by hand instead: 'Tag...' from tagItem
// (menus/colorBy.ts), 'Modifications' from modificationsMenu.ts, and
// 'Bisulfite / EM-seq' from bisulfiteMenu.ts.
const SPECIAL_COLOR_MENUS: Record<string, string> = {
  tag: 'Tag...',
  modifications: 'Modifications',
  bisulfite: 'Bisulfite / EM-seq',
}

// The two radios inside the Modifications submenu (modificationsMenu.ts). Which
// one a value means is the same `twoColor || fillUnmarked` test the menu uses to
// decide which radio reads as checked.
const MODIFICATION_BY_TYPE = 'One color per modification type'
const MODIFICATION_TWO_COLOR =
  'One color per type, plus low-probability & unmodified in blue'

function colorByStep(
  value: unknown,
  { displayType }: FieldContext,
): FieldStep | undefined {
  // The multi-sample variant displays reach colorBy through their own submenu
  // and name a sample attribute rather than a scheme, so they are answered
  // before the alignments registry is consulted at all.
  if (displayType && MULTI_SAMPLE_VARIANT_DISPLAYS.has(displayType)) {
    const attribute = asString(value)
    return attribute
      ? {
          path: `${TRACK_MENU} → Color by... → Samples → ${capitalizeFirst(attribute)}`,
          note: `The Samples section lists whichever metadata columns your samples carry, so "${attribute}" appears only if yours have it.`,
        }
      : undefined
  }
  const colorBy = asRecord(value)
  const mods = asRecord(colorBy?.modifications)
  const spelled = asString(colorBy?.type)
  // Retired spellings that normalizeColorBy() upgrades before any live code —
  // menu, legend, shader — ever sees them, so the path has to describe what the
  // upgraded value paints rather than the name the link carries: 'methylation'
  // is 'modifications' with fillUnmarked set, 'stranded' the firstOfPairStrand
  // it always meant.
  const type =
    spelled === 'methylation'
      ? 'modifications'
      : spelled === 'stranded'
        ? 'firstOfPairStrand'
        : spelled
  // matched by value rather than keyed, so no cast into ColorSchemeType is
  // needed to look up a scheme named by arbitrary JSON
  const scheme = Object.values(COLOR_SCHEMES).find(s => s.type === type)
  if (!scheme) {
    return undefined
  }
  const { menu } = scheme
  const inPairedEnd = menu.kind === 'radio' && menu.group === 'pairedEnd'
  const segments = [
    TRACK_MENU,
    'Color by...',
    ...(inPairedEnd ? ['Paired end'] : []),
    SPECIAL_COLOR_MENUS[scheme.type] ?? menu.label,
  ]
  if (scheme.type === 'modifications') {
    segments.push(
      spelled === 'methylation' || mods?.twoColor || mods?.fillUnmarked
        ? MODIFICATION_TWO_COLOR
        : MODIFICATION_BY_TYPE,
    )
  }
  // The bisulfite submenu leads with its cytosine-context radios, whose labels
  // are importable ('CpG' is not the 'CG' the spec stores). CG is the context
  // bisulfiteItem falls back to when the value names none.
  if (scheme.type === 'bisulfite') {
    const context = asString(mods?.cytosineContext) ?? 'CG'
    const option = cytosineContextOptions.find(o => o.value === context)
    if (option) {
      segments.push(option.label)
    }
  }
  const path = segments.join(' → ')
  const tag = asString(colorBy?.tag)
  return {
    path: tag ? `${path} → enter tag "${tag}"` : path,
    note:
      scheme.type === 'modifications'
        ? Array.isArray(mods?.shownModifications)
          ? 'Needs MM/ML modification tags in your BAM/CRAM. This figure also narrows the drawn types under Modifications → Modification types.'
          : 'Needs MM/ML modification tags in your BAM/CRAM.'
        : undefined,
  }
}

// The alignments display and LGVSyntenyDisplay build their "Group by..." submenu
// from the same groupByRadioMenuItem over the same dimension registry, so one
// path serves both: every dimension is a radio carrying its registry label.
// 'tag' is the exception — getGroupByMenuItem drops it from the radios in favor
// of a 'Tag...' item that opens a dialog for the tag itself.
function groupByStep(value: unknown): FieldStep | undefined {
  const groupBy = asRecord(value)
  const type = asString(groupBy?.type)
  const tag = asString(groupBy?.tag)
  if (type === 'tag' || (type === undefined && tag !== undefined)) {
    return tag
      ? {
          path: `${TRACK_MENU} → Group by... → Tag... → enter "${tag}"`,
          note:
            tag === 'HP'
              ? 'HP is the haplotype tag written by phasing tools like WhatsHap or Longphase.'
              : undefined,
        }
      : undefined
  }
  // matched by key rather than indexed, so no cast into GroupByType is needed to
  // look one up by arbitrary JSON (same reason colorByStep scans by value)
  const label = Object.entries(GROUP_BY_LABELS).find(([k]) => k === type)?.[1]
  return label
    ? {
        path: `${TRACK_MENU} → Group by... → ${label}`,
        note:
          type === 'mateAssembly'
            ? 'Synteny tracks only: one section per assembly on the other side of the alignment.'
            : undefined,
      }
    : undefined
}

// The synteny view's colour control is a palette button in the view header
// (ColorBySelector), not a menu entry, and its radios come from COLOR_MODES in
// synteny-core's colorByMenuItems.tsx. That module is .tsx and unimportable
// here, so the labels are verified by hand — and they had to be, because the
// neighbouring `colorByShortLabel` in the same package looks like the same
// table and is not: it titles the floating legend, where these read 'Query
// name' and 'Reference name'.
const SYNTENY_COLOR_MODES: Record<string, string> = {
  default: 'Default',
  strand: 'Strand',
  track: 'Distinct color per track',
  query: 'Query',
  target: 'Target',
  reference: 'Reference',
  identity: 'Identity',
  meanQueryIdentity: 'Mean query identity',
  mappingQuality: 'Mapping quality',
  dnds: 'dN/dS',
}

// `attribute:<column>` is the open arm of the mode list: a track's declared
// numeric columns are each offered under the column's own name, below the
// named presets. There is no fixed label to look up, so the column supplies it.
const SYNTENY_ATTRIBUTE_PREFIX = 'attribute:'

// The two multi-sample variant displays share one base model, so one path
// serves both. Unlike every other colorBy here the value is not an enum — it is
// whichever sample-metadata attribute the track carries, offered under a
// 'Samples' subheader, so the recipe names the figure's attribute rather than
// looking it up. capitalizeFirst is the menu's own label transform, imported.
const MULTI_SAMPLE_VARIANT_DISPLAYS = new Set([
  'LinearMultiSampleVariantDisplay',
  'LinearMultiSampleVariantMatrixDisplay',
])

// Mirrors the canvas display's own `colorByMode` getter (its baseModel.ts),
// which is what decides which of the three "Color by..." radios reads as
// checked: the exact strand expression is 'strand', any other jexl is
// 'attribute', anything else is a solid color. Both jexl strings are imported
// rather than retyped — the menu that writes them and the getter that
// recognizes them already share them by exact comparison, so a copy here would
// be a third place to drift.
//
// The 'attribute' radio opens a dialog that writes only attributeColorJexl(name),
// so an expression of any other shape lands in that mode without being reachable
// through it, and the config editor is the only way to author one. That is why
// this is the single recipe pointing at Settings, and it is not a general
// fallback: every field in the gap report is a config slot too, so answering
// them all that way would close the report by making it say nothing.
//
// Three displays take a `color`, and the submenu is the same one on two of
// them: LinearVariantDisplay is built on the same canvas base model, so its
// 'Solid color...' and 'Attribute...' rows open the identical dialogs and write
// the identical strings. It only swaps the radio list — no Strand row (variants
// have no strand) and two one-click presets in its place, from its own
// colorBySubMenuItems. LinearPairedArcDisplay is the odd one out and handled
// first: same slot, no color control at all.
//
// The two preset expressions are written out rather than imported, unlike every
// other value in this file. variantSvType.ts reaches the core util barrel
// through VcfFeature/util.ts, and this module is bundled into the site, so the
// import would pull the barrel onto the page to compare two short strings. The
// specs that set these presets (scripts/specs/ui.ts) hardcode them for the same
// reason. Drift degrades to the Settings fallback below rather than to a wrong
// path.
const VARIANT_COLOR_PRESETS: Record<string, string> = {
  // SV_TYPE_COLOR_JEXL, plugins/variants/src/shared/variantSvType.ts
  'jexl:svTypeColor(feature)': 'SV type',
  // CONSEQUENCE_IMPACT_JEXL, plugins/variants/src/shared/variantConsequence.ts
  'jexl:impactColor(feature)': 'Consequence impact',
}

function colorStep(
  value: unknown,
  { displayType }: FieldContext,
): FieldStep | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  // Its menu adds one row to the shared base — a line-width slider — so an arc
  // color is authored on the config however simple the expression is.
  if (displayType === 'LinearPairedArcDisplay') {
    return {
      path: `${TRACK_MENU} → Settings → color`,
      note: 'Arc color is jexl-evaluated per (feature, alt) and no menu writes it: the only control this display adds is its line-width slider.',
    }
  }
  if (
    displayType !== 'LinearBasicDisplay' &&
    displayType !== 'LinearVariantDisplay'
  ) {
    return undefined
  }
  const colorBy = `${TRACK_MENU} → Color by...`
  if (displayType === 'LinearVariantDisplay') {
    const preset = VARIANT_COLOR_PRESETS[value]
    if (preset) {
      return { path: `${colorBy} → ${preset}` }
    }
  } else if (value === STRAND_COLOR_JEXL) {
    return { path: `${colorBy} → Strand` }
  }
  if (!isJexl(value)) {
    return { path: `${colorBy} → Solid color... → ${value}` }
  }
  // Reconstructed through the exported builder rather than trusted from the
  // regex, so only the dialog's exact output claims the dialog's path.
  const attribute = /randomColor\(get\(feature,'([^']+)'\)\)/.exec(value)?.[1]
  return attribute && attributeColorJexl(attribute) === value
    ? { path: `${colorBy} → Attribute... → ${attribute}` }
    : {
        path: `${TRACK_MENU} → Settings → color`,
        note: `A per-feature expression. The Color by... radios write a solid color, a per-attribute palette, and ${
          displayType === 'LinearVariantDisplay'
            ? 'the SV-type and consequence-impact presets'
            : 'the strand preset'
        } only, so an expression of any other shape is authored on the track config.`,
      }
}

// One shared slider row (makeScatterPointSizeMenuItem) under a submenu each
// display titles for itself: the wiggle displays call it 'Scatter point size',
// the GWAS Manhattan display 'Point size'. The submenu label is what a reader
// looks for, so it is what varies here.
const POINT_SIZE_MENUS: Record<string, string> = {
  LinearWiggleDisplay: 'Scatter point size',
  MultiLinearWiggleDisplay: 'Scatter point size',
  LinearManhattanDisplay: 'Point size',
}

// `showTree` is one config name over two genuinely different controls, so the
// label is not shared even though the sidebar is. On the multi-wiggle display it
// reveals the dendrogram alone and lives inside the Clustering submenu; on the
// multi-row and MAF displays it gates the whole sidebar — dendrogram and row
// labels together — which is useful with no clustering run at all, so those keep
// it top-level under a fuller name. treeMenuItems.ts spells out the split, and
// the multi-row display opts out of the Clustering copy for exactly this reason.
const TREE_SIDEBAR_TOGGLE = 'Show sidebar with tree and labels'
const TREE_SIDEBAR_DISPLAYS = new Set([
  'LinearMafDisplay',
  'LinearMultiRowFeatureDisplay',
])

// The synteny view's 'CIGAR display mode' radios, imported. Its submenu sits in
// headerMenuItems beside Re-order chromosomes, gated on the data (coarse-tier
// PIF and CIGAR-less PAF have no ops), not on config.
const CIGAR_MODES: Record<string, string> = Object.fromEntries(
  CIGAR_MODE_OPTIONS.map(o => [o.value, o.label]),
)

// The two wiggle displays each open their own color editor from their own menu
// item, and the two dialogs are not the same component: the single-wiggle one
// leads with a Single color / Positive-negative toggle and carries the Pivot
// field, while the multi-wiggle one puts the two swatches under a 'Score sign
// colors' heading and has no pivot control at all.
const WIGGLE_COLOR_EDITORS: Record<string, string> = {
  LinearWiggleDisplay: 'Edit color...',
  MultiLinearWiggleDisplay: 'Edit colors/arrangement...',
}

// Where the positive/negative swatches sit inside each of those dialogs.
function scoreSignPath(displayType: string, side: 'Positive' | 'Negative') {
  const editor = `${TRACK_MENU} → ${WIGGLE_COLOR_EDITORS[displayType]}`
  return displayType === 'LinearWiggleDisplay'
    ? `${editor} → Positive/negative → ${side}`
    : `${editor} → Score sign colors → ${side}`
}

function scoreSignColorStep(
  side: 'Positive' | 'Negative',
): FieldRecipe {
  return (value, { displayType }) => {
    const color = asString(value)
    return color && displayType && displayType in WIGGLE_COLOR_EDITORS
      ? {
          path: `${scoreSignPath(displayType, side)} → ${color}`,
          note:
            displayType === 'MultiLinearWiggleDisplay'
              ? 'The two swatches are offered only in a multi-row plot type — an overlay paints each source\'s negative features in its own color, so there are no two sides to color.'
              : undefined,
        }
      : undefined
  }
}

// The MAF display stores what its rows are colored by across three slots that
// each predate the others (showTranslation, colorByChromosome, rowIdentityMode)
// while the menu presents them as one radio — they are alternatives, and only
// one paints. So each of those slots resolves to the same 'Row coloring' group,
// and its option labels are imported.
const ROW_COLORING = `${TRACK_MENU} → Row coloring`
const MAF_ROW_RENDERING_LABELS = new Map<string, string>([
  ...ROW_RENDERINGS.map(([v, l]) => [v, l] as [string, string]),
  [CODON_ROW_RENDERING[0], CODON_ROW_RENDERING[1]],
])

// HEIGHT_PRESETS in the MAF track menu, which writes rowHeight and
// rowProportion together — hand-verified, since its module pulls in the menu
// helpers, though the Normal height itself comes from the imported DEFAULTS.
const MAF_HEIGHT_PRESETS: { label: string; rowHeight: number }[] = [
  { label: 'Normal', rowHeight: DEFAULTS.rowHeight },
  { label: 'Compact', rowHeight: 8 },
]

function mafRowHeightPath(rowHeight: number) {
  if (rowHeight === 0) {
    return `${TRACK_MENU} → Row height → Squeeze to fit view`
  }
  const preset = MAF_HEIGHT_PRESETS.find(p => p.rowHeight === rowHeight)
  return preset
    ? `${TRACK_MENU} → Row height → ${preset.label}`
    : `${TRACK_MENU} → Row height → Custom... → ${rowHeight}px`
}

// The one dialog that edits row order, labels and which rows are shown. Each
// display names its menu item for what its own dialog covers.
const ROW_ARRANGEMENT_EDITORS: Record<string, string> = {
  LinearMafDisplay: 'Edit row arrangement...',
  LinearMultiRowFeatureDisplay: 'Edit colors/arrangement...',
  LinearMultiSampleVariantDisplay: 'Edit colors/arrangement...',
  LinearMultiSampleVariantMatrixDisplay: 'Edit colors/arrangement...',
  // The multi-wiggle reaches the same dialog from the same item, so it belongs
  // here as much as the four above — it was simply never added, and `layout` /
  // `subtreeFilter` on a multi-wiggle went unmapped as a result. It appears in
  // WIGGLE_COLOR_EDITORS as well, and the two are not one table: that one asks
  // which of the two wiggle displays' color editors a score-sign swatch is in,
  // this one asks which displays arrange rows at all.
  MultiLinearWiggleDisplay: 'Edit colors/arrangement...',
}

// wiggle-core's makeScoreSubMenu, which the alignments coverage band reuses
// under its own label — same rows inside, different name to look for. Its module
// pulls in the menu helpers, so these are hand-verified: 'Score' is the default
// in scoreMenuItems.ts, 'Coverage' the one alignments passes in coverage.ts.
const SCORE_MENUS: Record<string, string> = {
  LinearWiggleDisplay: 'Score',
  MultiLinearWiggleDisplay: 'Score',
  LinearAlignmentsDisplay: 'Coverage',
}

const SCALE_TYPES: Record<string, string> = {
  linear: 'Linear scale',
  log: 'Log scale',
}

// The alignments coverage band passes a shorter list whose σ label interpolates
// numStdDev, so it is deliberately not served here.
const AUTOSCALE_TYPES: Record<string, string> = Object.fromEntries(
  DEFAULT_AUTOSCALE_OPTIONS,
)

// Every display that filters names the item 'Filter by...' — the canvas base
// (trackMenus.ts), the alignments/LGVSynteny one (menus/filters.ts, which adds
// a count when filters are active), and the multi-sample variant one. So unlike
// most of this table the label does not vary; only which displays have it does.
//
// The two field names are one control. `jexlFilters` is the config-level slot
// (stored unprefixed, `jexl:` added on read) and `jexlFiltersSetting` is the
// session-level override the dialog actually writes, so a reader reproducing
// either arrives through the same dialog.
const FILTER_MENU_DISPLAYS = new Set([
  'LinearBasicDisplay',
  'LinearVariantDisplay',
  'LinearMultiRowFeatureDisplay',
  'LinearAlignmentsDisplay',
  'LGVSyntenyDisplay',
  'LinearMultiSampleVariantDisplay',
  'LinearMultiSampleVariantMatrixDisplay',
])

function filterStep(
  value: unknown,
  { displayType }: FieldContext,
): FieldStep | undefined {
  const filters = Array.isArray(value)
    ? value.filter(f => typeof f === 'string')
    : undefined
  return filters?.length && displayType && FILTER_MENU_DISPLAYS.has(displayType)
    ? {
        path: `${TRACK_MENU} → Filter by... → add ${filters.length === 1 ? 'the expression' : `the ${filters.length} expressions`}`,
        note: `This figure filters on ${filters.map(f => `\`${f.replace(/^jexl:/, '')}\``).join(', ')}.`,
      }
    : undefined
}

// The radios inside the alignments display's 'Arc color' submenu, imported so a
// renamed radio changes this table with it.
const ARC_COLORS: Record<string, string> = Object.fromEntries(
  ARC_COLOR_OPTIONS.map(o => [o.value, o.label]),
)

// The alignments 'Sort by...' radios (menus/sortGroup.ts). The strand row is
// titled from the track's noun, as the height submenus are.
function sortByLabel(type: string, noun: string) {
  return type === 'basePair'
    ? 'Base pair'
    : type === 'strand'
      ? `${capitalizeFirst(noun)} strand`
      : type === 'tag'
        ? 'Tag...'
        : undefined
}

// 'Show legend' and 'Show coverage' are spelled identically in the alignments
// display's Show submenu (menus/reads.ts) and the synteny display's
// (LGVSyntenyDisplay/menus.ts), so these only have to say which displays have
// the submenu at all.
const SHOW_SUBMENU_DISPLAYS = new Set([
  'LinearAlignmentsDisplay',
  'LGVSyntenyDisplay',
])

// The Hi-C display has the same 'Show...' submenu spelled the same way and the
// same 'Show legend' row at the top of it (LinearHicDisplay/trackMenuItems.ts),
// but none of the read-oriented rows beside it — so it joins the legend alone
// rather than the set above, which also answers showCoverage and
// collapseGroupRows.
const SHOW_LEGEND_DISPLAYS = new Set([
  ...SHOW_SUBMENU_DISPLAYS,
  'LinearHicDisplay',
])

// The displays composing LinearCanvasBaseDisplay, so they share its whole track
// menu: the size submenu, the flattened "Show..." one, and the right-click item
// that writes `featureHighlights`. LinearVariantDisplay is in it because it
// renames its noun rather than its behaviour — its menu row reads "Highlight
// variant" and is the same item, and its size submenu is titled with the same
// generic "feature" the gene one is (featureHeightMenuItems in the canvas
// display's trackMenus.ts says so in as many words).
const CANVAS_DISPLAYS = new Set(['LinearBasicDisplay', 'LinearVariantDisplay'])

// The three displays declaring `squashToHeight`, all of which draw a triangle
// whose natural height is half the view width: the Hi-C contact matrix and the
// two LD heatmaps. They share one menu-item helper, so they share the label.
const SQUASH_TO_HEIGHT_DISPLAYS = new Set([
  'LinearHicDisplay',
  'LDDisplay',
  'LDTrackDisplay',
])

// linkedReads, drawInter, drawLongRange, readConnectionsHeight and sortedBy are
// declared by LinearAlignmentsDisplay and nothing else, so unlike the fields
// above them the name settles the display on its own: an entry carrying one is
// either that display or a spec naming a slot no display has. That is what lets
// these answer an entry whose display type went unresolved.
function isAlignmentsOnlyField(displayType: string | undefined) {
  return displayType === undefined || displayType === 'LinearAlignmentsDisplay'
}

function isHicOnlyField(displayType: string | undefined) {
  return displayType === undefined || displayType === 'LinearHicDisplay'
}

const READ_CONNECTIONS_MENU = `${TRACK_MENU} → Read connections`
const BAND_OPTIONS = `${READ_CONNECTIONS_MENU} → Arc / read cloud band options`

function geneGlyphStep(value: unknown): FieldStep | undefined {
  const option = GENE_GLYPH_MODE_OPTIONS.find(o => o.value === value)
  return option
    ? { path: `${TRACK_MENU} → Gene glyph → ${option.label}` }
    : undefined
}

// The canvas display's "Subfeature labels" radios, imported ('none' reads as
// "Off" in the menu).
const SUBFEATURE_LABELS: Record<string, string> = Object.fromEntries(
  SUBFEATURE_LABEL_OPTIONS.map(o => [o.value, o.label]),
)

// The two displays that own a per-feature size submenu title it differently:
// the canvas display hard-codes 'Set feature height' (its trackMenus.ts), while
// getFeatureHeightMenuItem — used by the alignments display and
// LGVSyntenyDisplay — titles it after what the track holds. Both then group the
// sizing radios under the same 'Track sizing' subheader.
//
// An entry that named no display keeps the noun form this table has always
// emitted. That is an assumption, not a resolution, and it is the one place
// here that can still be wrong; resolving it needs pickDisplayForView's plugin
// registry.
const heightMenu = (noun: string, displayType?: string) =>
  displayType && CANVAS_DISPLAYS.has(displayType)
    ? `${TRACK_MENU} → Set feature height`
    : `${TRACK_MENU} → ${noun.charAt(0).toUpperCase()}${noun.slice(1)} height`

// The canvas display's two flat radio groups, both imported. Both recipes are
// gated on the display type because both field names mean a different menu
// elsewhere — the alignments display has its own displayMode, and showLabels on
// an LD display is a 'Show variant labels' checkbox.
const DISPLAY_MODES: Record<string, string> = Object.fromEntries(
  DISPLAY_MODE_OPTIONS.map(o => [o.value, o.label]),
)

// The arc display's `displayMode`, a different setting under the same name:
// what an arc is drawn as. Imported rather than copied, so a renamed radio
// changes this table with it — see the note on the import block above.
const ARC_DISPLAY_MODES: Record<string, string> = Object.fromEntries(
  ARC_DISPLAY_MODE_OPTIONS,
)

const SHOW_LABELS_MODES: Record<string, string> = Object.fromEntries(
  SHOW_LABELS_OPTIONS.map(o => [o.value, o.label]),
)

const SASHIMI_PLACEMENT: Record<string, string> = {
  auto: 'Auto (minimize overlap)',
  above: 'Above coverage',
  below: 'Below coverage',
}

// verified against getReadConnectionsMenuItem's own radios
// (plugins/alignments/src/LinearAlignmentsDisplay/menus/readConnections.ts).
// Both rows lead with "Show", which the shorter spellings here dropped.
const READ_CONNECTIONS: Record<string, string> = {
  arc: 'Show read arcs',
  cloud: 'Show read cloud',
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
  color: colorStep,
  jexlFilters: filterStep,
  jexlFiltersSetting: filterStep,
  // These three are declared by LinearHicDisplay alone, so as with the
  // alignments-only fields the name settles the display and an unresolved entry
  // can still be answered. All three are checkboxes in its Show submenu.
  useLogScale: (value, { displayType }) =>
    typeof value === 'boolean' && isHicOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Log scale (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  showResolutionControls: (value, { displayType }) =>
    typeof value === 'boolean' && isHicOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Show resolution controls (${value ? 'checked' : 'unchecked'})`,
          note: 'Puts a binsize dropdown in the track overlay, which is how a chosen resolution gets baked into a screenshot.',
        }
      : undefined,
  useColorPercentile: (value, { displayType }) =>
    typeof value === 'boolean' && isHicOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Show faint contacts (95th percentile) (${value ? 'checked' : 'unchecked'})`,
          note: 'Saturates the color scale at the 95th percentile instead of the maximum, so faint off-diagonal contacts read more strongly.',
        }
      : undefined,
  selectedNormalization: (value, { displayType }) =>
    typeof value === 'string' && isHicOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Normalization → ${value}`,
          note: 'The submenu lists only the schemes the file actually carries, and ticks the one the loaded matrix has rather than the one requested. NONE is raw observed counts, which is what a rearrangement needs — matrix balancing divides an amplified fusion back out.',
        }
      : undefined,
  resolutionBias: (value, { displayType }) =>
    typeof value === 'number' && isHicOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Resolution → ${value < 0 ? `Finer x${-value}` : `Coarser x${value}`}`,
          note: 'A signed offset from the zoom-derived binsize, not an absolute one, so it keeps tracking zoom. Reset returns to auto. Positive is coarser, which is what turns a sparse speckled matrix into visible domain blocks.',
        }
      : undefined,
  // Not Hi-C-only: LinearHicDisplay and the two LD displays all declare it, and
  // all three get the label from the one shared squashToHeightCheckboxItem
  // helper, so the path is the same for each. Gated on a resolved display type
  // rather than by name, since the name alone does not settle which it is.
  squashToHeight: (value, { displayType }) =>
    typeof value === 'boolean' &&
    displayType &&
    SQUASH_TO_HEIGHT_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Fit to display height (${value ? 'checked' : 'unchecked'})`,
          note: 'Squashes the triangle vertically to fill the track instead of drawing square bins at its natural half-the-view-width height. Unchecked keeps square bins, which fits when the feature of interest sits nearer the diagonal than the track is tall.',
        }
      : undefined,
  // ChordVariantDisplay's only, and it has no control — Chord.tsx reads the slot
  // straight through to the stroke.
  strokeColor: (value, { displayType }) =>
    typeof value === 'string' &&
    (displayType === undefined || displayType === 'ChordVariantDisplay')
      ? {
          path: `${TRACK_MENU} → Settings → strokeColor`,
          note: 'The chord outline color. No menu writes it, so it is set on the config like the other per-feature color expressions.',
        }
      : undefined,
  renderingMode: (value, { displayType }) =>
    typeof value === 'string' &&
    displayType &&
    MULTI_SAMPLE_VARIANT_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → Rendering mode → ${value === 'phased' ? 'Phased' : 'Allele count (dosage)'}`,
          note:
            value === 'phased'
              ? 'Splits each sample into one row per haplotype. The item stays disabled until phased variants are found in the file.'
              : undefined,
        }
      : undefined,
  featureColor: (value, { displayType }) =>
    value === 'svType' &&
    displayType &&
    MULTI_SAMPLE_VARIANT_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → Color by... → Cells → SV type`,
          note: 'Sits in the Cells section of that submenu, above the Samples one the sample palette comes from.',
        }
      : undefined,
  clusterRegion: (value, { displayType }) =>
    typeof value === 'string' &&
    displayType &&
    MULTI_SAMPLE_VARIANT_DISPLAYS.has(displayType)
      ? {
          path: `Navigate to the region you want to cluster on, then ${TRACK_MENU} → Cluster rows by genotype...`,
          note: `Clustering is scoped to the region it was run over — this figure clustered on ${value}, which is what the row order reflects even after navigating elsewhere.`,
        }
      : undefined,
  showRowSeparators: (value, { displayType }) =>
    typeof value === 'boolean' &&
    displayType === 'LinearMultiRowFeatureDisplay'
      ? {
          path: `${TRACK_MENU} → Show... → Show row separators (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  // Which attribute becomes the rows. The submenu's options are discovered from
  // the loaded features rather than configured, so the figure's own value is
  // the label to click — except a `jexl:` partition, which that menu shows as a
  // disabled row it cannot write (partitionMenuItems in the display's
  // trackMenuItems.ts).
  partitionField: (value, { displayType }) =>
    typeof value === 'string' &&
    !value.startsWith('jexl:') &&
    displayType === 'LinearMultiRowFeatureDisplay'
      ? {
          path: `${TRACK_MENU} → Partition by... → ${value}`,
          note: 'The list is built from the attributes the loaded features carry, so a track whose data has not loaded yet offers nothing.',
        }
      : undefined,
  showRowLabels: (value, { displayType }) =>
    typeof value === 'boolean' && displayType === 'MultiLinearWiggleDisplay'
      ? {
          path: `${TRACK_MENU} → Show... → Show row labels (${value ? 'checked' : 'unchecked'})`,
          note: value
            ? undefined
            : 'The labels only become worth turning off once the rows are too short to carry text, which is where they fall back to a bare column of colour swatches.',
        }
      : undefined,
  featureHighlights: (value, { displayType, noun }) =>
    Array.isArray(value) &&
    displayType &&
    CANVAS_DISPLAYS.has(displayType)
      ? {
          path: `Right-click the ${noun} → Highlight ${noun} (searching for it by name in the location box leaves the same highlight behind)`,
          note: `This figure highlights ${value.length} ${noun}${value.length === 1 ? '' : 's'}. The spec form differs from the click in one way that matters to a figure: a highlight the user did not click also sorts its ${noun} to a top row of the track, so it is boxed at the top of a dense lane rather than boxed several rows down.`,
        }
      : undefined,
  maxFeatureScreenDensity: (value, { displayType }) =>
    typeof value === 'number' && displayType === 'LinearBasicDisplay'
      ? {
          path: `${TRACK_MENU} → Settings → maxFeatureScreenDensity`,
          note: 'The features-per-pixel ceiling above which the track asks before drawing. Nothing sets it from a menu, so it is raised on the config.',
        }
      : undefined,
  linkedReads: (value, { displayType }) =>
    typeof value === 'string' && isAlignmentsOnlyField(displayType)
      ? {
          path: `${READ_CONNECTIONS_MENU} → View as pairs / link supplementary alignments (${value === 'off' ? 'unchecked' : 'checked'})`,
        }
      : undefined,
  drawLongRange: (value, { displayType }) =>
    typeof value === 'boolean' && isAlignmentsOnlyField(displayType)
      ? {
          path: `${BAND_OPTIONS} → Show off-screen mate connections (${value ? 'checked' : 'unchecked'})`,
          note: 'That submenu stays greyed out until an arc or read-cloud overlay is on.',
        }
      : undefined,
  drawInter: (value, { displayType }) =>
    typeof value === 'boolean' && isAlignmentsOnlyField(displayType)
      ? {
          path: `${BAND_OPTIONS} → Show inter-chromosomal pairs (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  readConnectionsHeight: (value, { displayType }) =>
    typeof value === 'number' && isAlignmentsOnlyField(displayType)
      ? {
          path: `Drag the handle at the edge of the arc band to resize it (${value}px here).`,
          note: 'Its tooltip reads "Drag to resize arcs area"; there is no menu entry for the height.',
        }
      : undefined,
  // The submenu is greyed out until chain mode is on, the same shape as the
  // arc band options above, and its tooltip names the switch that makes it
  // live. Worth the note: a reader who unchecks this without chain mode sees
  // nothing happen and concludes the setting does nothing.
  flipStrandLongReadChains: (value, { displayType }) =>
    typeof value === 'boolean' && isAlignmentsOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Color by... → Supplementary / split reads → Color supplementary alignments by consensus strand (${value ? 'checked' : 'unchecked'})`,
          note: 'Greyed out until "Read connections → View as pairs / link supplementary alignments" is on. It is what classifies a long read\'s segments against the orientation the chains on screen agree on, so unchecking it drops the red/blue split-segment colouring and the legend rows that go with it.',
        }
      : undefined,
  arcColorByType: (value, { displayType }) => {
    const label = typeof value === 'string' ? ARC_COLORS[value] : undefined
    return label && displayType === 'LinearAlignmentsDisplay'
      ? { path: `${TRACK_MENU} → Color by... → Arc color → ${label}` }
      : undefined
  },
  sortedBy: (value, { displayType, noun }) => {
    const type = asString(asRecord(value)?.type)
    const label = type ? sortByLabel(type, noun) : undefined
    return label && isAlignmentsOnlyField(displayType)
      ? {
          path: `${TRACK_MENU} → Sort by... → ${label}`,
          note: 'The sort is taken at the base under the centre line, so navigate to the position you want before sorting.',
        }
      : undefined
  },
  showLegend: (value, { displayType }) =>
    typeof value === 'boolean' &&
    displayType &&
    SHOW_LEGEND_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Show legend (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  showCoverage: (value, { displayType }) =>
    typeof value === 'boolean' &&
    displayType &&
    SHOW_SUBMENU_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Show coverage (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  collapseGroupRows: (value, { displayType }) =>
    typeof value === 'boolean' &&
    displayType &&
    SHOW_SUBMENU_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → Show... → Collapse groups to one row (${value ? 'checked' : 'unchecked'})`,
          note: 'Offered only once the reads are grouped, since it is what the groups collapse into.',
        }
      : undefined,
  hideSelfAlignments: (value, { displayType }) =>
    typeof value === 'boolean' && displayType === 'LGVSyntenyDisplay'
      ? {
          path: `${TRACK_MENU} → Group by... → Hide self-alignment lane (${value ? 'checked' : 'unchecked'})`,
          note: 'Below a divider at the foot of that submenu, and only meaningful on an all-vs-all track, which is what has a self lane.',
        }
      : undefined,
  scaleType: (value, { displayType }) => {
    const menu = displayType ? SCORE_MENUS[displayType] : undefined
    const label = typeof value === 'string' ? SCALE_TYPES[value] : undefined
    return menu && label
      ? { path: `${TRACK_MENU} → ${menu} → Scale type → ${label}` }
      : undefined
  },
  autoscale: (value, { displayType }) => {
    const label = typeof value === 'string' ? AUTOSCALE_TYPES[value] : undefined
    return label &&
      (displayType === 'LinearWiggleDisplay' ||
        displayType === 'MultiLinearWiggleDisplay')
      ? { path: `${TRACK_MENU} → Score → Autoscale type → ${label}` }
      : undefined
  },
  numStdDev: (value, { displayType }) =>
    typeof value === 'number' && displayType && displayType in SCORE_MENUS
      ? {
          path: `${TRACK_MENU} → Settings → numStdDev`,
          note: `How many standard deviations the "Local ± σ" autoscale spans. Nothing sets it from a menu — it only reads back out, as the σ in that option's own label — so it is set on the config.`,
        }
      : undefined,
  displayCrossHatches: (value, { displayType }) =>
    typeof value === 'boolean' &&
    (displayType === 'LinearWiggleDisplay' ||
      displayType === 'MultiLinearWiggleDisplay')
      ? {
          path: `${TRACK_MENU} → Show... → Show cross hatches (${value ? 'checked' : 'unchecked'})`,
          note: 'Absent in the density plot types, where score maps to color rather than height and a hatch would mark nothing.',
        }
      : undefined,
  colorByChromosome: (value, { displayType }) =>
    value === true && displayType === 'LinearMafDisplay'
      ? { path: `${ROW_COLORING} → ${MAF_ROW_RENDERING_LABELS.get('sourceChrom')}` }
      : undefined,
  rowIdentityMode: (value, { displayType }) => {
    const label =
      typeof value === 'string'
        ? MAF_ROW_RENDERING_LABELS.get(value)
        : undefined
    return label && displayType === 'LinearMafDisplay'
      ? { path: `${ROW_COLORING} → ${label}` }
      : undefined
  },
  rowIdentityAutoZoom: (value, { displayType }) =>
    typeof value === 'boolean' && displayType === 'LinearMafDisplay'
      ? {
          path: `${ROW_COLORING} → Show bases when zoomed in (${value ? 'checked' : 'unchecked'})`,
          note: 'Qualifies the two identity plots above it in that submenu, and does nothing under the other row colorings.',
        }
      : undefined,
  showConservation: (value, { displayType }) =>
    typeof value === 'boolean' && displayType === 'LinearMafDisplay'
      ? {
          path: `${TRACK_MENU} → Show... → Show conservation (% identity) (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  conservationMode: (value, { displayType }) => {
    const label = CONSERVATION_MODES.find(([v]) => v === value)?.[1]
    return label && displayType === 'LinearMafDisplay'
      ? {
          path: `${TRACK_MENU} → Show... → Conservation resolution → ${label}`,
          note: 'Offered only on a track with a mafFrames annotation adapter, since a per-codon reading needs a reading frame.',
        }
      : undefined
  },
  rowHeight: (value, { displayType }) =>
    typeof value === 'number' && displayType === 'LinearMafDisplay'
      ? { path: mafRowHeightPath(value) }
      : undefined,
  rowProportion: (value, { displayType }) =>
    typeof value === 'number' && displayType === 'LinearMafDisplay'
      ? {
          path: `${TRACK_MENU} → Row height`,
          note: `Each preset there sets the row height and the glyph's share of it (${value} here) together, so this follows from the same click as the height above.`,
        }
      : undefined,
  subtreeFilter: (value, { displayType }) => {
    const editor = displayType ? ROW_ARRANGEMENT_EDITORS[displayType] : undefined
    return Array.isArray(value) && editor
      ? {
          path: `${TRACK_MENU} → ${editor} → untick the rows you do not want`,
          note: `This figure keeps ${value.length} row${value.length === 1 ? '' : 's'}. The dendrogram is pruned to match, so it stays the tree of what is drawn.`,
        }
      : undefined
  },
  layout: (value, { displayType }) => {
    const editor = displayType ? ROW_ARRANGEMENT_EDITORS[displayType] : undefined
    if (!Array.isArray(value) || !editor) {
      return undefined
    }
    // One slot, two quite different reasons to set it, and the click inside the
    // dialog is not the same one: a saved order comes from dragging, a saved
    // color from the swatch column. A layout whose rows all carry a color was
    // written for the color, so lead with that rather than telling the reader
    // to drag rows that are already in adapter order.
    const colored = value.filter(
      row => typeof row === 'object' && row !== null && 'color' in row,
    ).length
    return colored === value.length
      ? {
          path: `${TRACK_MENU} → ${editor} → set each row's color`,
          note: `This figure colors all ${value.length} of its rows by hand rather than taking the palette. The same dialog also holds their order and labels.`,
        }
      : {
          path: `${TRACK_MENU} → ${editor} → drag the rows into order`,
          note: `The same dialog renames a row and recolors it, so a figure's ${value.length} rows carry their order, any labels it shows, and any color it picked.`,
        }
  },
  posColor: scoreSignColorStep('Positive'),
  negColor: scoreSignColorStep('Negative'),
  useBicolor: (value, { displayType }) =>
    typeof value === 'boolean' && displayType === 'LinearWiggleDisplay'
      ? {
          path: `${TRACK_MENU} → Edit color... → ${value ? 'Positive/negative' : 'Single color'}`,
        }
      : undefined,
  bicolorPivot: (value, { displayType }) => {
    if (typeof value !== 'number' || !displayType) {
      return undefined
    }
    if (displayType === 'LinearWiggleDisplay') {
      return {
        path: `${TRACK_MENU} → Edit color... → Positive/negative → Pivot → ${value}`,
      }
    }
    // The multi-wiggle editor writes the two swatches and nothing else, so this
    // is the config-editor case the `color` recipe above describes: a value the
    // menu provably cannot express, not one nobody has written a path for.
    return displayType === 'MultiLinearWiggleDisplay'
      ? {
          path: `${TRACK_MENU} → Settings → bicolorPivot`,
          note: `The score both sides are measured from. Its editor has no field for it — only the single-wiggle display's does — so on a multi-wiggle track it is set on the config.`,
        }
      : undefined
  },
  scatterPointSize: (value, { displayType }) => {
    const menu = displayType ? POINT_SIZE_MENUS[displayType] : undefined
    return typeof value === 'number' && menu
      ? {
          path: `${TRACK_MENU} → ${menu} → drag the slider to ${value}px`,
          // sizeSubMenu gates the wiggle one on renderingType.includes('scatter')
          note:
            displayType === 'LinearManhattanDisplay'
              ? undefined
              : 'The submenu is offered only while the plot type is one of the scatter renderings.',
        }
      : undefined
  },
  showTree: (value, { displayType }) => {
    if (typeof value !== 'boolean' || !displayType) {
      return undefined
    }
    const state = value ? 'checked' : 'unchecked'
    if (displayType === 'MultiLinearWiggleDisplay') {
      return {
        path: `${TRACK_MENU} → Clustering → Show tree (${state})`,
        note: 'On by default. The item is disabled until clustering has been run, and drops out entirely in the overlay plot types, which collapse every source onto one row for a dendrogram to align to.',
      }
    }
    return TREE_SIDEBAR_DISPLAYS.has(displayType)
      ? {
          path: `${TRACK_MENU} → ${TREE_SIDEBAR_TOGGLE} (${state})`,
          note: 'This one toggle covers the dendrogram and the row labels together; the labels have their own toggle beneath it once the sidebar is on.',
        }
      : undefined
  },
  groupBy: groupByStep,
  geneGlyphMode: geneGlyphStep,
  // the size presets carry their own pixel heights, so the figure's number
  // names its preset without a second table to keep in sync
  featureHeight: (value, { noun, displayType }) => {
    const preset = Object.values(COMPACTNESS_PRESETS).find(
      p => p.featureHeight === value,
    )
    const menu = heightMenu(noun, displayType)
    return {
      path: preset
        ? `${menu} → ${preset.label}`
        : `${menu} → Custom... → ${String(value)}px`,
    }
  },
  // 'Track sizing' is a subheader inside the same submenu as the size presets
  heightMode: (value, { noun, displayType }) => {
    const option = getHeightModeOptions(noun).find(o => o.value === value)
    return option
      ? {
          path: `${heightMenu(noun, displayType)} → Track sizing → ${option.label}`,
        }
      : undefined
  },
  // Both radios sit directly in the canvas display's size submenu, above the
  // 'Track sizing' subheader that heightMode lands under.
  displayMode: (value, { displayType }) => {
    if (typeof value !== 'string') {
      return undefined
    }
    // The arc display's own field of the same name, which is what the
    // connection is drawn AS rather than how tall it is
    // (ARC_DISPLAY_MODE_OPTIONS in arc/LinearArcDisplay/displayModes.ts).
    if (displayType === 'LinearArcDisplay') {
      const shape = ARC_DISPLAY_MODES[value]
      return shape ? { path: `${TRACK_MENU} → Display mode → ${shape}` } : undefined
    }
    const label = DISPLAY_MODES[value]
    return label && displayType && CANVAS_DISPLAYS.has(displayType)
      ? { path: `${TRACK_MENU} → Set feature height → ${label}` }
      : undefined
  },
  showLabels: (value, { displayType }) => {
    const label =
      typeof value === 'string' ? SHOW_LABELS_MODES[value] : undefined
    return label && displayType && CANVAS_DISPLAYS.has(displayType)
      ? { path: `${TRACK_MENU} → Show... → Labels → ${label}` }
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
  // Both live on the alignments display but in different submenus: the curve is
  // a rendering choice (menus/readConnections.ts), the filter a read-set one
  // (menus/reads.ts, inside the same "Show..." submenu as soft clipping).
  showBezierConnections: checkbox(
    'Read connections → Use curved connectors',
    "Draws a read's alignments joined by a curve rather than a straight line. Worth it when the two ends sit in different displayed regions, where the curve reads as one read crossing the gap.",
  ),
  showOnlySplitAlignments: checkbox(
    'Show... → Show only split alignments',
    'Keeps only reads the aligner gave a supplementary segment (SAM flag 0x800), so what is left is the breakpoint evidence rather than the pileup it sits in.',
  ),
  // Sits directly under "Show coverage" in the alignments "Show..." submenu
  // (menus/reads.ts). Unchecking it leaves the coverage band alone, which is
  // what a figure comparing depth across samples wants: at whole-gene zoom a
  // 30x pileup is a solid mass and only the curve carries the comparison.
  showPileup: checkbox(
    'Show... → Show pileup',
    'Drops the stacked-read band and keeps the coverage curve, so several samples can be compared on depth alone.',
  ),
  // Its own submenu rather than "Show...", because the arcs carry a placement
  // and a score threshold alongside the toggle (menus/sashimi.ts). Unchecking
  // leaves the coverage band, which is what a figure about the histogram wants:
  // the arcs are strand-colored too, from the XS/TS tag, and outdraw it.
  showSashimiArcs: checkbox(
    'Sashimi arcs → Show sashimi arcs',
    'Hides the splice-junction arcs and keeps the coverage band underneath them.',
  ),
  // Same label in the same submenu on both displays that have the slot: the
  // alignments "Show..." menu (menus/reads.ts) and LGVSyntenyDisplay's trimmed
  // copy of it (LGVSyntenyDisplay/menus.ts), so one path serves both.
  showMismatches: checkbox(
    'Show... → Show mismatches',
    'Per-base differences read from the CIGAR (and cs tag, on synteny tracks). Worth unchecking when zoomed out far enough that each one is sub-pixel and they paint over the block structure.',
  ),
  // A 'draw'/'skip' enum behind a checkbox, so it can't use `checkbox()` (which
  // only takes booleans). Label and polarity from the multi-sample variant
  // displays' own menu item: checked means 'draw'.
  referenceDrawingMode: value =>
    typeof value === 'string'
      ? {
          path: `${TRACK_MENU} → Show reference alleles (${
            value === 'skip' ? 'unchecked' : 'checked'
          })`,
          note: 'Off fills the lane solid grey and paints only ALT alleles, which reads better when a cell means "carries the variant". Turn it on where homozygous reference is itself the state of interest.',
        }
      : undefined,
  showOnlyGenes: checkbox('Show only genes'),
  // Three sibling checkboxes at the top of the reference-sequence track menu
  // (LinearReferenceSequenceDisplay.trackMenuItems)
  showForward: checkbox('Show forward'),
  showReverse: checkbox('Show reverse'),
  showTranslation: checkbox('Show translation'),
  showSashimiLabels: checkbox('Sashimi arcs → Show labels'),
  readConnectionsDown: checkbox(
    'Read connections → Arc / read cloud band options → Draw arcs below coverage band',
  ),
  minSashimiScore: numberField(n => ({
    path: `${TRACK_MENU} → Sashimi arcs → Filter by score → ${n}`,
    note: 'Hides splice junctions supported by fewer reads than this.',
  })),
  maxHeight: numberField(n => ({
    path: `${TRACK_MENU} → Read height → Set max layout height... → ${n}`,
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
  // `showDescriptions` has no entry on purpose. There is no "Show descriptions"
  // checkbox any more: it and the three-way name radio were folded into the one
  // Labels group, because the old pair let 'off' hide names while descriptions
  // kept painting — a state nothing in the UI named. Which rung a legacy key
  // becomes depends on the `showLabels` beside it, and a field handler sees only
  // its own value, so any path written here is right for one pairing and wrong
  // for the other. The specs have all been converted to the rung
  // migrateBasicConfigSnapshot resolves them to, so a `showDescriptions` showing
  // up in the gap report again is a spec to convert, not a handler to add.
  // The row inside Resolution is a custom control rather than a menu item —
  // two buttons either side of the current bin size (ResolutionStepper) — so
  // the path stops at the submenu and the note names what is in it, the same
  // way coverageHeight's does for a drag handle.
  resolution: numberField(n => ({
    path: `${TRACK_MENU} → Resolution`,
    note: `Step with Coarser and Finer, 2× per click; the caption between them reads the current bin size. Higher fetches finer bins, and this figure uses ${resolutionLabel(n)}.`,
  })),
  minScore: numberField(n => ({
    path: `${TRACK_MENU} → Score → Set min/max score...`,
    note: `Sets the score-axis minimum (${n} here).`,
  })),
  maxScore: numberField(n => ({
    path: `${TRACK_MENU} → Score → Set min/max score...`,
    note: `Sets the score-axis maximum (${n} here).`,
  })),
  significanceLine: numberField(n => ({
    path: `${TRACK_MENU} → Set significance line...`,
    note: `Draws a horizontal line at this score (${n} here), on the same scale as the plotted points. Clearing the field removes it.`,
  })),
  coverageHeight: numberField(() => ({
    path: 'Drag the bottom edge of the coverage band to resize it.',
  })),
  // Same shape as coverageHeight: the band has a drag handle at its lower edge
  // (LinesConnectingMatrixToGenomicPosition, in both the matrix and LD
  // displays), and no menu item — so a drag is the verified path rather than a
  // guessed label.
  lineZoneHeight: numberField(() => ({
    path: 'Drag the bottom edge of the band of connecting lines above the rows to resize it.',
  })),
  forceLoad: value =>
    value === true
      ? {
          path: 'Click Force load in the track\'s "Zoom in to see features or force load" message.',
          note: 'Loads the region even past the byte-size limit, which can be slow.',
        }
      : undefined,
  // The limit that message is measured against. No menu sets a byte count, so
  // the click path is the same banner forceLoad names, and the number itself is
  // a config slot. Said together because a reader who only clicks pays the
  // click on every region.
  fetchSizeLimit: numberField(n => ({
    path: 'Click Force load in the track\'s "Zoom in to see features or force load" message, or set fetchSizeLimit in the track config to stop being asked.',
    note: `This figure raises the limit to ${n.toLocaleString('en-US')} bytes because the region is a genuinely large read.`,
  })),
  // The two ways a multi-row display derives its row order, as opposed to a
  // `layout`/`rowOrder` that states one outright. They are easy to confuse, so
  // each note says what the order is computed FROM: clustering uses the whole
  // region in view, the sort uses a single column.
  runClustering: value =>
    value === true
      ? {
          path: `${TRACK_MENU} → Clustering → Cluster rows by similarity`,
          note: 'Orders the rows by how alike they are across the region in view, and draws the tree it built beside them. It clusters over what is displayed, so the same menu item somewhere else gives a different order.',
        }
      : undefined,
  // Two displays carry this property and each names its own menu item and its
  // own value, so the note is written per display rather than for whichever one
  // came first — the reason FieldContext carries `displayType` at all.
  sortRowsBy: (value, { displayType }) => {
    const at = asRecord(value)
    const refName = asString(at?.refName)
    const pos = at?.pos
    if (!refName || typeof pos !== 'number') {
      return undefined
    }
    const where = `${refName}:${pos.toLocaleString('en-US')}`
    return displayType === 'MultiLinearWiggleDisplay'
      ? {
          path: 'Right-click the track at the column to sort on → Sort rows by score here',
          note: `Ranks the subtracks by the score each one carries at a single base (${where} in this figure), highest at the top, which is how a cohort is read at a candidate locus. "Reset row order" in the same menu undoes it.`,
        }
      : {
          path: 'Right-click the track at the column to sort on → Sort rows by color here',
          note: `Reorders the rows by the value each one carries at a single position (${where} in this figure), which is how a painting is lined up under a peak. "Reset row order" in the same menu undoes it.`,
        }
  },
}

const TRACK_LABELS: Record<string, string> = {
  overlapping: 'Overlapping',
  offset: 'Offset',
  hidden: 'Hidden',
}

// GraphGenomeView settings. The plugin is third-party, so there is no option
// table to import the way the alignments ones are imported: every label below is
// read off the bundle the figures actually render, which is pinned by
// content-addressed esmUrl in test_data/graphgenomeview, so it cannot drift
// without a diff in this repo. `Layout` and `Color` are selects in the view's own
// toolbar. The rest are selects in the `Graph settings` dialog, which the view
// menu opens with its `Settings` item, and which is the answer to "where is this
// in the GUI" for a reader who only has the figure (review, on graph_context:
// "what the gui is for selecting this, user might not intuitively understand").
//
// **Re-read them when that esmUrl hash moves.** The pin is what keeps the labels
// true, not what keeps them complete: the plugin grew a fourth bubble spread and
// the figures used it for months while this table knew three, which showed up
// only as a name in spec-recipe-unmapped.txt. A rename is the half that list
// cannot see, so check-spec-recipes asserts every label below against a
// graphgenomeview checkout when one is on disk.
const GRAPH_LAYOUTS: Record<string, string> = {
  auto: 'Anchored',
  samplerows: 'Sample rows',
  force: 'Force-directed layout',
}

const GRAPH_COLOR_SCHEMES: Record<string, string> = {
  auto: 'Auto',
  uniform: 'Uniform',
  random: 'Random',
  rainbow: 'Rainbow',
  depth: 'Depth',
  'node-length': 'Node Length',
  'stable-rank': 'Stable rank',
  'reference-position': 'Reference position',
  grey: 'Grey',
}

const GRAPH_BUBBLE_SPREADS: Record<string, string> = {
  auto: 'Proportional',
  open: 'Open bubbles',
  wide: 'Wide bubbles',
  compress: 'Compress lengths',
}

// The Layout quality radio, which is FMMM's iteration budget rather than a
// rendering knob: 0 is 3 fixed + 1 fine-tuning iteration and 4 is 120 + 60
// (graphlayout.cpp in jbrowse-plugin-graphgenomeview). Labels read off that
// plugin's own `qualityLabels`; it is a separate repo, so unlike the alignments
// tables this one cannot be imported and has to be checked against the source
// when it changes.
const GRAPH_LAYOUT_QUALITIES: Record<number, string> = {
  0: 'Lowest',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Highest',
}

const GRAPH_CONTEXTS: Record<number, string> = {
  0: 'None',
  1: '1 hop',
  2: '2 hops',
}

const GRAPH_SETTINGS = 'Graph view menu → Settings'

// The labels above, plus the two controls that hold them, as one list for
// check-spec-recipes to assert against the plugin's own source. Grouped by the
// control they belong to so a failure names where to look rather than only what
// went missing.
export const GRAPH_LABELS: Record<string, string[]> = {
  'Layout select': Object.values(GRAPH_LAYOUTS),
  'Color select': Object.values(GRAPH_COLOR_SCHEMES),
  'Bubble spread select': Object.values(GRAPH_BUBBLE_SPREADS),
  'Layout quality radios': Object.values(GRAPH_LAYOUT_QUALITIES),
  'Graph context select': Object.values(GRAPH_CONTEXTS),
  'the settings dialog itself': ['Settings', 'Graph context', 'Layout quality'],
}

const graphToolbarField = (
  label: string,
  table: Record<string, string>,
): FieldRecipe => {
  return value => {
    const option = typeof value === 'string' ? table[value] : undefined
    return option
      ? { path: `Graph view toolbar → ${label} → ${option}` }
      : undefined
  }
}

const graphSettingsField = (
  label: string,
  table: Record<string, string>,
  note?: string,
): FieldRecipe => {
  return value => {
    const option = typeof value === 'string' ? table[value] : undefined
    return option
      ? { path: `${GRAPH_SETTINGS} → ${label} → ${option}`, note }
      : undefined
  }
}

// Both views run the same reorder — runDiagonalize, behind the identical
// 'Re-order chromosomes' item — but reach it from different headers: the synteny
// view's is in headerMenuItems, under the "View options" button
// (ViewOptionsMenuButton), and the dotplot's is in the overflow menu in
// DotplotControls. The init flag runs it once as the view opens rather than
// naming a different feature, so the step is the menu item either way.
const DIAGONALIZE_MENUS: Record<string, string> = {
  LinearSyntenyView: 'Synteny view header → View options → Re-order chromosomes',
  DotplotView: 'Dotplot header → the ⋮ menu → Re-order chromosomes',
}

// The settings popover behind the sliders (TuneIcon) button in each view's
// header — one shared SettingsPopover whose tooltip is the title each view
// passes it, so the button a reader looks for is named differently per view
// while the row inside is the same 'Min length:'.
const SETTINGS_POPOVERS: Record<string, string> = {
  LinearSyntenyView: 'Synteny display settings',
  DotplotView: 'Dotplot display settings',
}

export const viewFields: Record<string, FieldRecipe> = {
  alpha: (value, { viewType }) => {
    const popover = viewType ? SETTINGS_POPOVERS[viewType] : undefined
    return typeof value === 'number' && popover
      ? {
          path: `${popover} (the sliders button in the view header) → Opacity: → drag to ${value}`,
          note: 'Lower values let dense overlapping ribbons show through each other.',
        }
      : undefined
  },
  cigarMode: (value, { viewType }) => {
    const label = typeof value === 'string' ? CIGAR_MODES[value] : undefined
    return label && viewType === 'LinearSyntenyView'
      ? {
          path: `Synteny view header → View options → CIGAR display mode → ${label}`,
          note: 'The submenu appears only when the alignments actually carry CIGAR ops — a coarse-tier PIF or a CIGAR-less PAF has none to draw.',
        }
      : undefined
  },
  // A view's own height, which both of these give a drag bar for rather than a
  // menu entry (CircularView's ResizeHandle, the SvInspectorView's between its
  // panes). ProteinView also takes one but is a third-party plugin, so it is
  // left reported with the rest of its fields.
  height: (value, { viewType }) =>
    typeof value === 'number' &&
    (viewType === 'CircularView' || viewType === 'SvInspectorView')
      ? {
          path: `Drag the bar at the bottom edge of the view to resize it (${value}px here).`,
        }
      : undefined,
  showHighlightChips: (value, { viewType }) =>
    typeof value === 'boolean' && viewType === 'LinearGenomeView'
      ? {
          path: `View menu → Bookmarks/highlights → Show highlight chips (${value ? 'checked' : 'unchecked'})`,
          note: 'Greyed out while highlights themselves are hidden — the chip is drawn on a highlight band.',
        }
      : undefined,
  showIntraviewLinks: (value, { viewType }) =>
    typeof value === 'boolean' && viewType === 'BreakpointSplitView'
      ? {
          path: `View menu → Show... → Show intra-view links (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  // Both comparative views carry the same palette button (ColorBySelector), so
  // one entry serves them and only the header it sits in differs.
  showColorLegend: (value, { viewType }) => {
    const header =
      viewType === 'DotplotView'
        ? 'Dotplot header'
        : viewType === 'LinearSyntenyView'
          ? 'Synteny view header'
          : undefined
    return typeof value === 'boolean' && header
      ? {
          path: `${header} → palette button → Show color legend (${value ? 'checked' : 'unchecked'})`,
          note: 'The last item in the same menu the color modes are in.',
        }
      : undefined
  },
  minAlignmentLength: (value, { viewType }) => {
    const popover = viewType ? SETTINGS_POPOVERS[viewType] : undefined
    return typeof value === 'number' && popover
      ? {
          path: `${popover} (the sliders button in the view header) → Min length: → drag to ${value.toLocaleString('en-US')}bp`,
          note: 'Hides alignments shorter than this, which is what clears the hairball of short spurious chains at whole-genome zoom.',
        }
      : undefined
  },
  autoDiagonalize: (value, { viewType }) => {
    const menu = viewType ? DIAGONALIZE_MENUS[viewType] : undefined
    if (typeof value !== 'boolean' || !menu) {
      return undefined
    }
    return value
      ? {
          path: menu,
          note: 'Reorders and flips each row so the best-hit blocks line up on a diagonal. The spec runs it once as the view opens; the menu item is the same thing on demand.',
        }
      : {
          path: "Nothing to run — the view keeps each assembly's own chromosome order.",
          note: 'Re-order chromosomes is the opt-in, and this figure leaves it alone on purpose: the order along the axis is part of what the figure is showing.',
        }
  },
  // Applied while the view is built (afterAttach sets scalebarOnly on any row
  // the launch gave no tracks), so the control is the launch dialog's checkbox
  // rather than anything on the finished view.
  collapseEmptyRows: (value, { viewType }) =>
    typeof value === 'boolean' && viewType === 'LinearSyntenyView'
      ? {
          path: `Launch synteny view dialog → Collapse panels to rulers (${value ? 'checked' : 'unchecked'})`,
          note: 'Checked by default. A row the launch gave no tracks opens as its ruler alone instead of a "No tracks active" block; any row expands again from its own controls afterwards.',
        }
      : undefined,
  // Applied by initHelpers as levels[i].setHeight(h), and the only thing that
  // calls setHeight from the UI is the ResizeHandle bar under each level
  // (LinearComparativeRenderArea) — there is no menu entry or dialog for it.
  levelHeights: (value, { viewType }) => {
    const heights =
      Array.isArray(value) && value.every(n => typeof n === 'number')
        ? value
        : undefined
    return heights?.length && viewType === 'LinearSyntenyView'
      ? {
          path: 'Drag the bar below a synteny level to resize it.',
          note:
            heights.length === 1
              ? `This figure's level is ${heights[0]}px tall.`
              : `This figure's ${heights.length} levels are ${heights.join(', ')}px tall.`,
        }
      : undefined
  },
  colorBy: (value, { viewType }) => {
    const label =
      typeof value === 'string'
        ? (SYNTENY_COLOR_MODES[value] ??
          (value.startsWith(SYNTENY_ATTRIBUTE_PREFIX)
            ? value.slice(SYNTENY_ATTRIBUTE_PREFIX.length)
            : undefined))
        : undefined
    // Both comparative views carry the same palette button; only the header it
    // sits in differs, the same split showColorLegend makes.
    const header =
      viewType === 'LinearSyntenyView'
        ? 'Synteny view header'
        : viewType === 'DotplotView'
          ? 'Dotplot header'
          : undefined
    return label && header
      ? {
          path: `${header} → palette button → ${label}`,
          note:
            value === 'reference'
              ? 'The palette button\'s tooltip reads "Color by: ...". Reference is offered only in a stacked view of three or more genomes, where there is a shared reference to trace.'
              : 'The palette button\'s tooltip reads "Color by: ...".',
        }
      : undefined
  },
  // The file a spreadsheet-backed view opens on. Both launchers that accept it
  // (LaunchSvInspectorView, LaunchSpreadsheetView) hand it to the same import
  // wizard the view shows while its spreadsheet is uninitialized, so one path
  // serves both and only the Add entry differs — hence the note rather than a
  // first segment this table has no view type to choose between (see the
  // FieldContext comment above). Labels verified against ImportWizard.tsx
  // (selectorTypes, the Open button), SourceTypeSelector.tsx (the File/URL
  // toggles) and UrlChooser.tsx ('Enter URL').
  uri: value => {
    const uri = asString(value)
    return uri
      ? {
          path: 'Import form → Open file from URL or local computer → URL → Enter URL → Open',
          note: 'Open the form with Add → SV inspector (or Add → Spreadsheet view); set File Type and Assembly in the same form before clicking Open.',
        }
      : undefined
  },
  // The parser the import form applies to the file, which it otherwise infers
  // from the extension. Named in the same form as `uri`, one radio row above
  // the Assembly dropdown (ImportWizard.tsx's RadioSelector, legend "File
  // Type", options from the `fileTypes` list).
  fileType: value => {
    const type = asString(value)
    return type
      ? {
          path: `Import form → File Type → ${type}`,
          note: 'Only needed when the filename does not end in the type, which is why a STAR-Fusion `.tsv` has to be named and a `.vcf.gz` does not.',
        }
      : undefined
  },
  // The same search box the user types in, which is why this reads as an action
  // rather than a setting: the grid's quick filter matches the text against
  // every visible column at once, so one term can select rows by chromosome, by
  // gene name or by SV type depending on what the file carries.
  filterText: value => {
    const text = asString(value)
    return text
      ? {
          path: `Type "${text}" into the table's search box (the magnifier above the grid)`,
          note: "In the SV inspector the circular view draws only the rows the search leaves, so this narrows the chords too — it does not change which regions the circle shows, which is the 'show only regions with data' checkbox beside it.",
        }
      : undefined
  },
  // not a menu item: ViewContainerTitle renders the header title as an
  // EditableTypography whose tooltip is "(click to rename)"
  displayName: value => {
    const name = typeof value === 'string' ? value : undefined
    return name
      ? { path: `Click the view's title in its header and enter "${name}"` }
      : undefined
  },
  showCenterLine: value =>
    typeof value === 'boolean'
      ? {
          path: `View menu → Show... → Show center line (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  trackLabels: value => {
    const option = typeof value === 'string' ? TRACK_LABELS[value] : undefined
    return option ? { path: `View menu → Track labels → ${option}` } : undefined
  },
  colorByCDS: value =>
    typeof value === 'boolean'
      ? {
          path: `View menu → Color CDS by reading frame (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  showAminoAcids: value =>
    typeof value === 'boolean'
      ? {
          path: `View menu → Show... → Show amino acids when zoomed in (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  // The checkbox carries the placeholder's visibility, so it reads the inverse
  // of the field: hiding it is the box unchecked. A synteny row takes this the
  // same way any other LGV does, through the per-row launch props.
  hideNoTracksActive: value =>
    typeof value === 'boolean'
      ? {
          path: `View menu → Show... → Show no tracks active button (${value ? 'unchecked' : 'checked'})`,
        }
      : undefined,
  drawCurves: value =>
    typeof value === 'boolean'
      ? {
          path: `Synteny view menu → Show curved lines (${value ? 'checked' : 'unchecked'})`,
        }
      : undefined,
  // An action rather than a checkbox (LinearSyntenyView's `showMenuItems`), so
  // only a `true` has a click-path: it re-fits every row to one shared bp/px,
  // and there is no un-checking it — you'd re-navigate instead.
  sameScale: value =>
    value === true
      ? {
          path: 'Synteny view menu → Show all regions at same scale',
          note: 'Row length becomes genome size, which is what makes the rows comparable.',
        }
      : undefined,
  // How the view got there at all, which is the step a reader with only the
  // figure is missing: a graph view is launched from a segments track rather
  // than added empty. The item is the plugin's own
  // 'Graph genome view (this region)' inside core's 'Launch view' submenu
  // (pushLaunchViewMenuItem).
  loadedTrackId: value =>
    typeof value === 'string'
      ? {
          path: `${TRACK_MENU} (on the graph segments track) → Launch view → Graph genome view (this region)`,
          note: 'Launching from the track is what ties the two panels together: the graph is cut from the same file the lane above it draws.',
          opensView: true,
        }
      : undefined,
  loadedRegion: value =>
    asRecord(value)
      ? {
          path: 'Set the location box before launching the graph view.',
          note: 'The cut is the window the linear view was showing, so the graph covers what you were looking at.',
        }
      : undefined,
  // The other way a graph view gets its data, and the one a reader bringing a
  // .gfa of their own takes: the view opens on its own import form ("Load a GFA
  // graph"), which reads a whole file rather than cutting one from a track.
  gfaLocation: value =>
    asRecord(value)
      ? {
          path: 'Open the view: **Add → Graph genome view**, then on its "Load a GFA graph" form paste the URL and click **Open** (or **Choose file** for a local .gfa)',
          note: 'Loads the whole graph, so it suits a subgraph or a small assembly. A window of a large one is cut from a segments track instead.',
          opensView: true,
        }
      : undefined,
  layoutMode: graphToolbarField('Layout', GRAPH_LAYOUTS),
  colorScheme: graphToolbarField('Color', GRAPH_COLOR_SCHEMES),
  layoutQuality: value => {
    const option =
      typeof value === 'number' ? GRAPH_LAYOUT_QUALITIES[value] : undefined
    return option
      ? {
          path: `${GRAPH_SETTINGS} → Layout quality → ${option}`,
          note: 'How many iterations the force layout runs. The default is enough for a small graph; raising it is what removes crossings from a drawing that has any.',
        }
      : undefined
  },
  bubbleSpread: graphSettingsField(
    'Bubble spread',
    GRAPH_BUBBLE_SPREADS,
    'Sets a floor on how long a node is drawn in the force layout, so a short allele is a visible arm rather than a speck. Does nothing in the anchored layouts, which place a node from its coordinates.',
  ),
  // a switch rather than a select, so it states its own state instead of naming
  // an option
  drawPaths: value =>
    typeof value === 'boolean'
      ? {
          path: `${GRAPH_SETTINGS} → Draw paths (${value ? 'on' : 'off'})`,
          note: 'Colors every node and connector by the P/W records through it, one lane per path in legend order, so a path that skips a node leaves its lane empty. Needs a GFA that states its paths: an rGFA and an indexed cut both carry segments and links only.',
        }
      : undefined,
  // the select lists the GFA's own path names, so the figure's value IS the
  // option a reader picks
  referencePath: value =>
    typeof value === 'string'
      ? {
          path: `${GRAPH_SETTINGS} → Reference path → ${value}`,
          note: 'Which path the anchored layouts draw x against. Only offered when the file states more than one.',
        }
      : undefined,
  // the only numeric one of the graph settings, so it can't use the string
  // tables above
  subgraphContext: value =>
    typeof value === 'number' && GRAPH_CONTEXTS[value]
      ? {
          path: `${GRAPH_SETTINGS} → Graph context → ${GRAPH_CONTEXTS[value]}`,
          note: 'How far the cut follows links out of the region. Each hop costs a query per off-reference segment already reached, so it stops at one by default.',
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
//
// Keep this list to fields that can never acquire a click-path. A field that has
// no path *yet* belongs in the gap report, where writing its recipe is a visible
// win; hiding one here retires it silently and makes the report's `+`/`-` lines
// mean less. `id` qualifies because it is capture scaffolding — a spec pins it so
// the screenshot's own actions and callouts can address one view among several,
// and a reader reproducing the figure by hand never types it.
export const IGNORED_FIELDS = new Set([
  'type',
  'trackId',
  'assembly',
  'loc',
  'tracks',
  'views',
  'sessionTracks',
  'displayedRegionNames',
  'id',
])
