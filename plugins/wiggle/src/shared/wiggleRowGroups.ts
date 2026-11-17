import { rowFieldValue } from '@jbrowse/tree-sidebar'

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
 * one row color, where they share one.
 */
export function wiggleRows<S extends LabelledRow>(
  sources: readonly S[],
  field: string,
  {
    sort,
    labels,
  }: {
    sort: readonly string[]
    labels: Readonly<Record<string, string>>
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
            rowColor: colors.size === 1 ? rowColor : undefined,
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

/** What {@link wiggleRowGroupViews} reads: the field and the rows drawn. */
export interface WiggleRowGroupHost {
  rowsField: string
  drawnRows: LabelledRow[]
  rowSort: string[]
  rowLabels: Readonly<Record<string, string>>
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
     * The rows drawn, each with the sources it overlays (`wiggleRows`).
     */
    get wiggleRows() {
      return wiggleRows(self.drawnRows, self.rowsField, {
        sort: self.rowSort,
        labels: self.rowLabels,
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
