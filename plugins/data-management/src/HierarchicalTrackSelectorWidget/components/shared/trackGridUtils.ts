import { measureGridWidth } from '@jbrowse/core/util'

export function measureNameColumnWidth(rows: { name: string }[]) {
  return (
    measureGridWidth(
      rows.map(r => r.name),
      { maxWidth: 500, stripHTML: true },
    ) + 15
  )
}
