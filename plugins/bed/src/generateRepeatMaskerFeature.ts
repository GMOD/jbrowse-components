const REPEAT_MASKER_NUMERIC_FIELD_INDICES = [0, 1, 2, 3, 5, 6] as const

export function isRepeatMaskerDescriptionField(desc?: string): desc is string {
  const descriptionFields = desc?.trim().split(' ')
  return REPEAT_MASKER_NUMERIC_FIELD_INDICES.every(fieldIndex =>
    descriptionFields?.[fieldIndex] !== undefined
      ? !Number.isNaN(+descriptionFields[fieldIndex])
      : false,
  )
}

function makeRepeatTrackDescription(description?: string) {
  if (isRepeatMaskerDescriptionField(description)) {
    const fields = description.trim().split(' ')
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
    ] = fields

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
  const { subfeatures: _unusedSubfeatures, ...restWithoutSubfeatures } = rest
  return {
    ...restWithoutSubfeatures,
    ...makeRepeatTrackDescription(description),
    uniqueId,
    refName,
    start,
    end,
  }
}
