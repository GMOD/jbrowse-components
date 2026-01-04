import { makeStyles } from '@jbrowse/core/util/tss-react'

export const useTooltipStyles = makeStyles()(() => ({}))

export function pct(n: number, total = 1) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

export function formatStrandCounts(entry: {
  '1'?: number
  '-1'?: number
}): string {
  const neg = entry['-1'] ? `${entry['-1']}(-)` : ''
  const pos = entry['1'] ? `${entry['1']}(+)` : ''
  return neg + pos || '-'
}
