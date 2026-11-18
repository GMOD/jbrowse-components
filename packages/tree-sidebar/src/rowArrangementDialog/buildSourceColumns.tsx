import { SanitizedHTML } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'

import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

/**
 * The colors pinned on rows, which the swatch column edits: the colors
 * picked by row name, and what a pick writes.
 */
export interface EachRowPicks {
  picks: ReadonlyMap<string, string>
  onPick: (picked: ReadonlyMap<string, string>) => void
}

export interface SourceRow<S> {
  id: string
  source: S
}

function fieldText(row: unknown, field: string) {
  return getStr((row as Record<string, unknown>)[field] ?? '')
}

export function buildSourceColumns<S extends { name: string }>({
  colors,
  eachRow,
  extras,
  rows,
  cellClassName,
}: {
  colors: ReadonlyMap<string, string>
  eachRow: EachRowPicks
  extras: string[]
  rows: S[]
  cellClassName: string
}) {
  const columns: (VirtualTableColumn<SourceRow<S>> & { width: number })[] = [
    {
      id: 'rowColorSwatch',
      header: 'Color',
      width: 70,
      cell: ({ source }) => (
        <PopoverPicker
          color={colors.get(source.name) ?? 'auto'}
          unset={!eachRow.picks.has(source.name)}
          onChange={next => {
            eachRow.onPick(new Map([[source.name, next]]))
          }}
        />
      ),
    },
    {
      id: 'name',
      header: 'Name',
      width: measureGridWidth(rows.map(r => r.name)),
      title: ({ source }) => source.name,
      cell: ({ source }) => source.name,
    },
    ...extras.map(
      (field): VirtualTableColumn<SourceRow<S>> & { width: number } => ({
        id: field,
        header: field,
        width: measureGridWidth(rows.map(r => fieldText(r, field))),
        cell: ({ source }) => (
          <div className={cellClassName}>
            <SanitizedHTML html={fieldText(source, field)} />
          </div>
        ),
      }),
    ),
  ]
  return columns.map((col, i) => ({ ...col, fill: i === columns.length - 1 }))
}
