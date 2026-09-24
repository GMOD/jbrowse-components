import type { ShapeName } from '../util/markEncodingTypes.ts'
import type { RampStop } from './colorScale.ts'

// One filled box in one color — or, for a key over a point mark's `shape`
// channel, that shape in the color.
export interface LegendSwatch {
  color: string
  shape?: ShapeName
}

// A continuous bar in place of a swatch: the ramp a scalar is painted
// through, with its domain ends printed beneath. What Hi-C, LD and the synteny
// identity modes key by.
export interface LegendGradient {
  stops: RampStop[]
  minLabel: string
  maxLabel: string
}

export interface ColorLegendEntry {
  // React key; keep distinct across entries
  key: string
  label: string
  // CSS color for the default square swatch
  color?: string
  // several colors or a shape on one row; takes precedence over `color`
  swatches?: LegendSwatch[]
  // toggled-off entries render dimmed and struck through
  hidden?: boolean
  // a ramp row: the bar draws under `label`, which may be empty
  gradient?: LegendGradient
}

// One swatch of a color vocabulary. `color` is omitted for a row that is text
// only (a heading, a note).
//
// `swatches` is for the row two vocabularies produced: one meaning, drawn twice
// in different colors (a pale pileup fill and the saturated stroke its arc
// needs to stay visible). Listing that twice repeats the label and listing it
// once drops a color the display really painted, so the row keeps both boxes.
// Set it OR `color`, not both — `legendSwatches` prefers it.
export interface LegendItem {
  // the datum the row classifies, handed back to a display whose rows act
  // (`FloatingLegend`'s `onItemClick`); absent for a note row
  value?: string
  color?: string
  swatches?: LegendSwatch[]
  gradient?: LegendGradient
  label: string
  // Toggled off — the row draws dimmed and struck through. Per ITEM rather than
  // applied by the caller over the flattened result, because a display with
  // several sections usually has only one toggleable vocabulary: mapping a
  // hidden-label set over everything `legendEntries` emits also strikes through
  // the other sections' rows and the section titles, on a label collision the
  // reader has no way to undo.
  hidden?: boolean
}

// The boxes a row draws: its explicit list, else its single color, else nothing
// at all (a heading).
export function legendSwatches(item: LegendItem): LegendSwatch[] {
  return (
    item.swatches ?? (item.color === undefined ? [] : [{ color: item.color }])
  )
}

// One color vocabulary. A display that colors by several at once (genotype
// colors vs. sample-grouping colors, read fills vs. arc colors) gives each its
// own section, so each can be titled and dismissed independently.
export interface LegendSection {
  id: string
  title?: string
  // A line under the title in the section's own words, drawn whether or not
  // the title is: a rule the swatches cannot state, and the reader still needs
  // it when the rows below collapse.
  note?: string
  items: LegendItem[]
  // Its items name sets of rows, so `FloatingLegend` renders them as buttons
  // when it has an `onItemClick`; without this the section stays inert text
  // even beside one that acts.
  focusesRows?: boolean
}

// What a display says about its colors, once. `FloatingLegend` renders this on
// screen; `legendEntries` turns the same value into `SvgColorLegend` rows for
// the export, so the two can't describe different things.
export interface LegendSpec {
  // heading for the whole box, shown regardless of section count
  title?: string
  sections: LegendSection[]
}

// Drop sections with nothing in them, so a heading can never end up with no
// swatches under it.
export function nonEmptyLegendSections(sections: readonly LegendSection[]) {
  return sections.filter(s => s.items.length > 0)
}

// Flatten a legend spec into `SvgColorLegend` rows: a color-less row reads as a
// heading rather than a swatch. Section titles appear only when more than one
// section survives — a lone vocabulary needs no title above it — which is the
// rule `FloatingLegend` applies on screen, so an export and the live legend
// agree about when headings show. A box-level `title` is unconditional, like its
// on-screen counterpart.
export function legendEntries(spec: LegendSpec): ColorLegendEntry[] {
  const sections = nonEmptyLegendSections(spec.sections)
  const titled = sections.length > 1
  return [
    ...(spec.title === undefined
      ? []
      : [{ key: 'legend-title', label: spec.title }]),
    ...sections.flatMap(section => [
      ...(titled && section.title !== undefined
        ? [{ key: `${section.id}-title`, label: section.title }]
        : []),
      ...(section.note === undefined
        ? []
        : [{ key: `${section.id}-note`, label: section.note }]),
      ...section.items.map((item, idx) => ({
        key: `${section.id}-${idx}`,
        label: item.label,
        color: item.color,
        swatches: item.swatches,
        hidden: item.hidden,
        gradient: item.gradient,
      })),
    ]),
  ]
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
