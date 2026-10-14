// An autoSql may declare a standard BED column `string`, as UCSC's panelApp
// bigBeds do for the block columns, and @gmod/bed then hands back the text
export type NumberColumn = number | string
export type NumberListColumn = number[] | string[] | string

export function toNumber(value: NumberColumn | undefined) {
  if (value === undefined || value === '') {
    return undefined
  }
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

export function toNumberList(value: NumberListColumn | undefined) {
  return typeof value === 'string'
    ? value
        .split(',')
        .filter(s => s !== '')
        .map(Number)
    : typeof value?.[0] === 'string'
      ? value.map(Number)
      : (value as number[] | undefined)
}
