const NUMERIC_PARTS = [0, 1, 2, 3, 5, 6]

// RepeatMasker .out-derived description: 15 space-separated fields, numeric at
// positions 0,1,2,3,5,6. A literal rather than an object built from the field
// list, since this runs on every line of a RepeatMasker track.
export function parseRepeatMaskerDescription(desc: unknown) {
  if (typeof desc !== 'string') {
    return undefined
  }
  const p = desc.trim().split(' ')
  for (const i of NUMERIC_PARTS) {
    const v = p[i]
    if (v === undefined || Number.isNaN(+v)) {
      return undefined
    }
  }
  return {
    bitsw_score: p[0] ?? '',
    percent_div: p[1] ?? '',
    percent_del: p[2] ?? '',
    percent_ins: p[3] ?? '',
    query_chr: p[4] ?? '',
    query_begin: p[5] ?? '',
    query_end: p[6] ?? '',
    query_remaining: p[7] ?? '',
    orientation: p[8] ?? '',
    matching_repeat_name: p[9] ?? '',
    matching_repeat_class: p[10] ?? '',
    matching_repeat_begin: p[11] ?? '',
    matching_repeat_end: p[12] ?? '',
    matching_repeat_remaining: p[13] ?? '',
    repeat_id: p[14] ?? '',
  }
}
