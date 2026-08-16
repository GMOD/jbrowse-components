import type { ColorLegendEntry } from './SvgColorLegend.tsx'

// How a color is drawn, so a key row can carry the mark it belongs to instead
// of a square for everything: a filled body (a read, a feature, a bar), a
// straight connector, or a curved one. Omitted means 'fill'.
//
// A legend that mixes marks needs this to say anything true. A display drawing
// both bodies and connectors keys colors from both vocabularies, and with only
// squares available the two are indistinguishable — the reader is told a color
// exists but not what shape to look for.
export type LegendMark = 'fill' | 'line' | 'curve'

// One drawn mark in one color.
export interface LegendSwatch {
  color: string
  mark?: LegendMark
}

// One swatch of a color vocabulary. `color` is omitted for a row that is text
// only (a heading, a note).
//
// `swatches` is for the row two vocabularies produced: one meaning, drawn twice
// in different colors (a pale pileup fill and the saturated stroke its arc
// needs to stay visible). Listing that twice repeats the label and listing it
// once drops a color the display really painted, so the row keeps both marks.
// Set it OR `color`/`mark`, not both — `legendSwatches` prefers it.
export interface LegendItem {
  color?: string
  mark?: LegendMark
  swatches?: LegendSwatch[]
  label: string
  // Toggled off — the row draws dimmed and struck through. Per ITEM rather than
  // applied by the caller over the flattened result, because a display with
  // several sections usually has only one toggleable vocabulary: mapping a
  // hidden-label set over everything `legendEntries` emits also strikes through
  // the other sections' rows and the section titles, on a label collision the
  // reader has no way to undo.
  hidden?: boolean
}

// The marks a row draws: its explicit list, else its single color/mark pair,
// else nothing at all (a heading).
export function legendSwatches(item: LegendItem): LegendSwatch[] {
  return (
    item.swatches ??
    (item.color === undefined ? [] : [{ color: item.color, mark: item.mark }])
  )
}

// One color vocabulary. A display that colors by several at once (genotype
// colors vs. sample-grouping colors, read fills vs. arc colors) gives each its
// own section, so each can be titled and dismissed independently.
export interface LegendSection {
  id: string
  title?: string
  items: LegendItem[]
}

// What a display says about its colors, once. `FloatingLegend` renders this on
// screen; `legendEntries` turns the same value into `SvgColorLegend` rows for
// the export, so the two can't describe different things.
export interface LegendSpec {
  // heading for the whole box, shown regardless of section count
  title?: string
  // shorthand for a single untitled section
  items?: LegendItem[]
  sections?: LegendSection[]
}

// Drop sections with nothing in them, so a heading can never end up with no
// swatches under it.
export function nonEmptyLegendSections({ items, sections }: LegendSpec) {
  return (sections ?? (items ? [{ id: 'items', items }] : [])).filter(
    s => s.items.length > 0,
  )
}

// Flatten a legend spec into `SvgColorLegend` rows: a color-less row reads as a
// heading rather than a swatch. Section titles appear only when more than one
// section survives — a lone vocabulary needs no title above it — which is the
// rule `FloatingLegend` applies on screen, so an export and the live legend
// agree about when headings show. A box-level `title` is unconditional, like its
// on-screen counterpart.
export function legendEntries(spec: LegendSpec): ColorLegendEntry[] {
  const sections = nonEmptyLegendSections(spec)
  const titled = sections.length > 1
  return [
    ...(spec.title === undefined
      ? []
      : [{ key: 'legend-title', label: spec.title }]),
    ...sections.flatMap(section => [
      ...(titled && section.title !== undefined
        ? [{ key: `${section.id}-title`, label: section.title }]
        : []),
      ...section.items.map((item, idx) => ({
        key: `${section.id}-${idx}`,
        label: item.label,
        color: item.color,
        swatches: exportSwatches(item),
        hidden: item.hidden,
      })),
    ]),
  ]
}

// A single filled swatch is what `color` alone already draws, so only a row
// that says something more — several marks, or one that isn't a fill — carries
// the list into the export. Keeps the common entry the three fields it has
// always been.
function exportSwatches(item: LegendItem) {
  const swatches = legendSwatches(item)
  return swatches.length > 1 || swatches.some(s => s.mark && s.mark !== 'fill')
    ? swatches
    : undefined
}

/**
 * How many rows a color key may have and still be one. Past this it is a list
 * of every row, which is the thing a key exists instead of.
 */
export const MAX_LEGEND_ITEMS = 20

/**
 * Whether a key built from these items is worth the rows it costs, for a
 * display that has to *decide* — one whose key is only sometimes the thing
 * naming its colors, and which therefore asks before drawing.
 *
 * Two questions, and both have drawn a useless key on a real track:
 *
 * - **Short enough to read?** A list longer than a reader can scan is worse
 *   than whatever it was going to explain. Ask this of the collapsed items, not
 *   of the row count — a cohort track's key is one row per group, so 4,390
 *   cells in nine cell types is nine rows and passes, while the same cells
 *   ungrouped are 4,390 and do not.
 * - **Does it distinguish anything?** A key maps colors to names, so it needs
 *   more than one color to map. Items that all share one — every swatch having
 *   resolved to the same fallback, which is what a track carrying no identity
 *   color produces — spend rows over the plot to say nothing. This is why
 *   `LegendItem.color` should be resolved before it gets here: an unresolved
 *   `undefined` compares equal to every other `undefined` only by accident.
 *
 * Displays whose key is unconditional (alignments, variants) don't need this;
 * their vocabulary is always worth naming.
 */
export function legendIsReadable(
  items: LegendItem[],
  maxItems = MAX_LEGEND_ITEMS,
) {
  return items.length <= maxItems && new Set(items.map(i => i.color)).size > 1
}
