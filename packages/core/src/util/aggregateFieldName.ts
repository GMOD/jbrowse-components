/**
 * The field an aggregate op writes: `as` where named, else `count` for a
 * count, else `<op>_<field>`. Imports nothing, so the validator's copy of the
 * mark rule list carries it unchanged.
 */
export function aggregateFieldName({
  op,
  field,
  as,
}: {
  op: string
  field?: string
  as?: string
}) {
  return as || (op === 'count' || !field ? op : `${op}_${field}`)
}
