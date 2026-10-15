/**
 * A GFF3 column 9 keyed as the file writes it (`ID`, `Name`, `gene_name`),
 * each value the comma-separated list the column gives, %-escapes decoded.
 * `@gmod/gff-nostream` lowercases the keys for JBrowse's own reads, which a
 * host reading the file's fields should not see.
 */
export function fileAttributes(column: string) {
  const out: Record<string, string[]> = {}
  if (column === '.' || column === '') {
    return out
  }
  for (const entry of column.split(';')) {
    const eq = entry.indexOf('=')
    const key = unescape(entry.slice(0, eq).trim())
    const values = entry
      .slice(eq + 1)
      .trimEnd()
      .split(',')
      .filter(v => v !== '')
      .map(unescape)
    if (eq > 0 && key && values.length) {
      out[key] = values
    }
  }
  return out
}

function unescape(s: string) {
  return s.includes('%')
    ? s.replaceAll(/(?:%[\dA-Fa-f]{2})+/g, run => {
        try {
          return decodeURIComponent(run)
        } catch {
          return run
        }
      })
    : s
}
