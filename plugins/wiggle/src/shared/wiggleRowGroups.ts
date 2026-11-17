import { rowFieldValue } from '@jbrowse/tree-sidebar'

import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'
import type { LabelledRow } from '@jbrowse/tree-sidebar'

/**
 * One drawn row of a wiggle display: what its label column names it, and the
 * sources it draws, overlaid where there are several.
 */
export interface WiggleRow<S extends LabelledRow> {
  row: LabelledRow
  sources: S[]
}

/** Whether `rows.field` gathers subtracks by an attribute, several to a row. */
export function groupsSources(field: string) {
  return field !== '' && field !== 'source'
}

/** The value a source takes its row by: its name under `source`. */
export function sourceRowValue(source: { name: string }, field: string) {
  return field === 'source' ? source.name : rowFieldValue(source, field)
}

/**
 * The rows `rows.field` lays `sources` out in: one box every source shares
 * under `''`, a row per source under `source`, and under any other field a
 * row per value of that subtrack attribute. Grouped rows come in the order
 * of their earliest entry in `sort`, by value or by a member's name, then in
 * the order their first source arrives, so a reorder of the subtracks moves
 * their rows and a `rows.sort` of values orders the rows directly. A row's
 * label is `labels[value]`, else the value; its color bar is its sources'
 * one row color where `colorBar` holds and they share one.
 */
export function wiggleRows<S extends LabelledRow>(
  sources: readonly S[],
  field: string,
  {
    sort,
    labels,
    colorBar,
  }: {
    sort: readonly string[]
    labels: Readonly<Record<string, string>>
    colorBar: boolean
  },
): WiggleRow<S>[] {
  if (field === '') {
    return [{ row: { name: '' }, sources: [...sources] }]
  } else if (field === 'source') {
    return sources.map(source => ({ row: source, sources: [source] }))
  } else {
    const byValue = new Map<string, S[]>()
    for (const source of sources) {
      const value = sourceRowValue(source, field)
      const members = byValue.get(value)
      if (members) {
        members.push(source)
      } else {
        byValue.set(value, [source])
      }
    }
    const sortIndex = new Map<string, number>()
    sort.forEach((name, i) => {
      if (!sortIndex.has(name)) {
        sortIndex.set(name, i)
      }
    })
    const rankOf = (value: string, members: S[]) =>
      Math.min(
        sortIndex.get(value) ?? Infinity,
        ...members.map(m => sortIndex.get(m.name) ?? Infinity),
      )
    return [...byValue.entries()]
      .map(([value, members], arrival) => ({
        value,
        members,
        arrival,
        rank: rankOf(value, members),
      }))
      .sort((a, b) => a.rank - b.rank || a.arrival - b.arrival)
      .map(({ value, members }) => {
        const colors = new Set(members.map(m => m.rowColor))
        const [rowColor] = colors
        return {
          row: {
            name: value,
            label: labels[value] ?? (value === '' ? `(no ${field})` : value),
            rowColor: colorBar && colors.size === 1 ? rowColor : undefined,
          },
          sources: members,
        }
      })
  }
}

/** Each source's row index under {@link wiggleRows}, by name. */
export function sourceRowIndex<S extends LabelledRow>(rows: WiggleRow<S>[]) {
  const index = new Map<string, number>()
  rows.forEach((row, i) => {
    for (const source of row.sources) {
      index.set(source.name, i)
    }
  })
  return index
}

const SEPARATORS = String.raw`[\s_.,;:/|()[\]-]*`

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `label` with its row's `value` taken off its start or end, with the
 * whitespace or punctuation between: `GM12878 Hap1` in row `GM12878` is
 * `Hap1`.
 */
export function roleLabel(label: string, value: string) {
  const v = escapeRegExp(value)
  const leading = new RegExp(`^${v}${SEPARATORS}`)
  const trailing = new RegExp(`${SEPARATORS}${v}$`)
  return value === ''
    ? label
    : leading.test(label)
      ? label.replace(leading, '')
      : label.replace(trailing, '')
}

/**
 * The row color key over grouped rows: an entry per subtrack role rather
 * than per subtrack, each subtrack named with its row's value taken off
 * (`roleLabel`), and the subtracks sharing a role and a color merged into
 * one entry. The key as given wherever an entry names no subtrack, a role
 * comes out empty, or one role takes two colors.
 */
export function roleKeyScale(
  scale: CategoricalScale,
  rows: readonly WiggleRow<LabelledRow>[],
): CategoricalScale {
  const valueOf = new Map(
    rows.flatMap(row => row.sources.map(s => [s.name, row.row.name] as const)),
  )
  const roles = new Map<string, { color?: string; values: string[] }>()
  let merges = true
  for (const entry of scale.entries) {
    const value = valueOf.get(entry.value)
    const label =
      value === undefined ? '' : roleLabel(entry.label, value).trim()
    const role = roles.get(label)
    if (label === '' || (role && role.color !== entry.color)) {
      merges = false
    } else if (role) {
      role.values.push(entry.value)
    } else {
      roles.set(label, { color: entry.color, values: [entry.value] })
    }
  }
  return merges
    ? {
        ...scale,
        focusesRows: false,
        entries: [...roles].map(([label, { color, values }]) => ({
          value: values[0]!,
          values,
          label,
          color,
        })),
      }
    : scale
}

/** What {@link wiggleRowGroupViews} reads: the field and the rows drawn. */
export interface WiggleRowGroupHost {
  rowsField: string
  drawnRows: LabelledRow[]
  rowSort: string[]
  rowLabels: Readonly<Record<string, string>>
  rowColorChannel: { field: string }
}

/**
 * The rows a wiggle display draws its sources in, which the display and a
 * static export install alike.
 */
export function wiggleRowGroupViews(self: WiggleRowGroupHost) {
  return {
    /**
     * #getter
     * Whether `rows.field` names a subtrack attribute, so the subtracks
     * sharing a value overlay in one row.
     */
    get isGroupedRows() {
      return groupsSources(self.rowsField)
    },
    /**
     * #getter
     * The rows drawn, each with the sources it overlays (`wiggleRows`). A
     * grouped row's label bar shows only where `rows.color` names a field,
     * whose key says what the bar means; a palette dealt by name colors the
     * sources, not the row.
     */
    get wiggleRows() {
      return wiggleRows(self.drawnRows, self.rowsField, {
        sort: self.rowSort,
        labels: self.rowLabels,
        colorBar: self.rowColorChannel.field !== 'name',
      })
    },
    /**
     * #getter
     * Each drawn source's row, by name.
     */
    get sourceRowIndex(): ReadonlyMap<string, number> {
      return sourceRowIndex(this.wiggleRows)
    },
    /**
     * #getter
     * What the row labels name: the sources themselves on a row each, a
     * value of the field per row where they are grouped.
     */
    get labelledRows(): LabelledRow[] {
      return this.isGroupedRows
        ? this.wiggleRows.map(r => r.row)
        : self.drawnRows
    },
  }
}
