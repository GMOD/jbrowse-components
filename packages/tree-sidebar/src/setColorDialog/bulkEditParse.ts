const DELIM = /[,\t]/

const splitCols = (line: string) => line.split(DELIM)

const nonEmptyLines = (val: string) =>
  val
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

// Pair a header's field names with a row's column values into a record.
const zipRecord = (fields: string[], cols: string[]) =>
  Object.fromEntries(fields.map((f, i) => [f, cols[i] ?? '']))

// Parse CSV/TSV with a header row that includes a `name` column for join.
export function parseRowsByName(val: string) {
  const lines = nonEmptyLines(val)
  const header = lines[0]
  if (!header) {
    throw new Error('Nothing pasted: expected a header row plus data rows')
  }
  const fields = splitCols(header)
  const nameIdx = fields.indexOf('name')
  if (nameIdx === -1) {
    throw new Error('No "name" column found on line 1')
  }
  return Object.fromEntries(
    lines.slice(1).flatMap(line => {
      const cols = splitCols(line)
      const name = cols[nameIdx]
      return name ? [[name, zipRecord(fields, cols)]] : []
    }),
  )
}

// Join parsed rows (by name) onto the current layout. `replace` drops the
// existing fields first; otherwise the parsed values patch over them. `name`
// is always preserved as the join key.
export function mergeParsedRows<S extends { name: string }>(
  currLayout: S[],
  byName: Record<string, Record<string, string>>,
  replace: boolean,
) {
  return currLayout.map(record => ({
    ...(replace ? {} : record),
    ...byName[record.name],
    name: record.name,
  })) as S[]
}
