export function isRepeatMaskerDescriptionField(desc?: string): desc is string {
  const ret = desc?.trim().split(' ')
  return [0, 1, 2, 3, 5, 6].every(s =>
    ret?.[s] !== undefined ? !Number.isNaN(+ret[s]) : false,
  )
}

function makeRepeatTrackDescription(description?: string) {
  if (isRepeatMaskerDescriptionField(description)) {
    const [
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
    ] = description.trim().split(' ')
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
  return { description }
}

export function generateRepeatMaskerFeature({
  uniqueId,
  refName,
  start,
  end,
  description,
  ...rest
}: {
  uniqueId: string
  refName: string
  start: number
  end: number
  description: string
  [key: string]: unknown
}) {
  return {
    ...rest,
    ...makeRepeatTrackDescription(description),
    uniqueId,
    refName,
    start,
    end,
  }
}
