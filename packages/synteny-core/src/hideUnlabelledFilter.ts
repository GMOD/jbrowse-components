import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// `{ field, valid: true }` and nothing else: the entry "Hide unlabelled rows"
// writes for the field the ribbons paint by
function isValidOnly(p: FieldPredicate, field: string) {
  return (
    p.field === field &&
    p.valid === true &&
    Object.keys(p).every(k => k === 'field' || k === 'valid')
  )
}

/** Whether `filter` holds the "Hide unlabelled rows" entry for `field`. */
export function hidesUnlabelled(
  filter: readonly FieldPredicate[],
  field: string | undefined,
) {
  return field !== undefined && filter.some(p => isValidOnly(p, field))
}

/**
 * `filter` with the "Hide unlabelled rows" entry for `field` added or taken
 * out. A painter switching field takes its old field's entry out, since the
 * box it reads keys only the field it paints by.
 */
export function withHideUnlabelled(
  filter: readonly FieldPredicate[],
  field: string,
  hide: boolean,
): FieldPredicate[] {
  const rest = filter.filter(p => !isValidOnly(p, field))
  return hide ? [...rest, { field, valid: true }] : rest
}
