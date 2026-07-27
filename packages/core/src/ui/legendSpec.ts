import type { ColorLegendEntry } from './SvgColorLegend.tsx'

// One swatch of a color vocabulary. `color` is omitted for a row that is text
// only (a heading, a note).
export interface LegendItem {
  color?: string
  label: string
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
      })),
    ]),
  ]
}
