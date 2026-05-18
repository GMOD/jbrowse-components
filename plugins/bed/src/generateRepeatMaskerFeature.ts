export interface RepeatMaskerFields {
  bitsw_score: string
  percent_div: string
  percent_del: string
  percent_ins: string
  query_chr: string
  query_begin: string
  query_end: string
  query_remaining: string
  orientation: string
  matching_repeat_name: string
  matching_repeat_class: string
  matching_repeat_begin: string
  matching_repeat_end: string
  matching_repeat_remaining: string
  repeat_id: string
}

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
      const [
        bitsw_score = '',
        percent_div = '',
        percent_del = '',
        percent_ins = '',
        query_chr = '',
        query_begin = '',
        query_end = '',
        query_remaining = '',
        orientation = '',
        matching_repeat_name = '',
        matching_repeat_class = '',
        matching_repeat_begin = '',
        matching_repeat_end = '',
        matching_repeat_remaining = '',
        repeat_id = '',
      ] = parts
      return {
        bitsw_score,
        percent_div,
        percent_del,
        percent_ins,
        query_chr,
        query_begin,
        query_end,
        query_remaining,
        orientation,
        matching_repeat_name,
        matching_repeat_class,
        matching_repeat_begin,
        matching_repeat_end,
        matching_repeat_remaining,
        repeat_id,
      }
    }
  }
  return undefined
}
