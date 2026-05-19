const FIELDS = [
  'bitsw_score',
  'percent_div',
  'percent_del',
  'percent_ins',
  'query_chr',
  'query_begin',
  'query_end',
  'query_remaining',
  'orientation',
  'matching_repeat_name',
  'matching_repeat_class',
  'matching_repeat_begin',
  'matching_repeat_end',
  'matching_repeat_remaining',
  'repeat_id',
] as const

export type RepeatMaskerFields = Record<(typeof FIELDS)[number], string>

// RepeatMasker .out-derived description: 15 space-separated fields with numeric
// values at positions 0,1,2,3,5,6. Returns parsed fields or undefined if the
// description doesn't match the format.
export function parseRepeatMaskerDescription(
  desc: unknown,
): RepeatMaskerFields | undefined {
  if (typeof desc === 'string') {
    const parts = desc.trim().split(' ')
    const looksRight = [0, 1, 2, 3, 5, 6].every(
      i => parts[i] !== undefined && !Number.isNaN(+parts[i]),
    )
    if (looksRight) {
      return Object.fromEntries(
        FIELDS.map((f, i) => [f, parts[i] ?? '']),
      ) as RepeatMaskerFields
    }
  }
  return undefined
}
