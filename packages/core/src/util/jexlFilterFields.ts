import { callSubject, pathSubject, print } from '@jbrowse/jexl'

import { JEXL_PREFIX, isJexl } from './jexlStrings.ts'

export type JexlFilterField = {
  label: string
  /** unset for a field whose values may be numbers or text */
  type?: 'number' | 'text' | 'flag'
  group?: string
  description?: string
  values?: string[]
} & ({ path: string[] } | { call: string })

/** The expression reading `field` off a feature, e.g. `feature.INFO.AF`. */
export function fieldExpression(field: JexlFilterField) {
  return print(
    ('call' in field
      ? callSubject('feature', field.call)
      : pathSubject('feature', field.path)
    ).node,
  )
}

// a feature carries these as refName, start and end
const BED_LOCUS_COLUMNS = new Set(['chrom', 'chromStart', 'chromEnd'])

/**
 * The columns an adapter's metadata describes as `{column: description}`, as
 * a BigBed's autoSql does, less those `fields` already lists. Any other
 * metadata describes none.
 */
export function describedColumns(
  metadata: unknown,
  fields: readonly JexlFilterField[],
): JexlFilterField[] {
  const entries =
    metadata && typeof metadata === 'object' ? Object.entries(metadata) : []
  const listed = new Set(fields.map(field => field.label))
  return entries.every(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
    ? entries
        .filter(([name]) => !listed.has(name) && !BED_LOCUS_COLUMNS.has(name))
        .map(([name, description]) => ({
          label: name,
          path: [name],
          description: description || undefined,
        }))
    : []
}

export function stripJexlPrefix(line: string) {
  return isJexl(line) ? line.slice(JEXL_PREFIX.length) : line
}
