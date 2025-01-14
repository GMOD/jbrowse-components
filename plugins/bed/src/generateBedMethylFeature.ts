export function isBedMethylFeature({
  splitLine,
}: {
  splitLine: string[]
  start: number
  end: number
}) {
  return (
    // if it has comma-y blocks, not bedMethyl
    !splitLine[10]?.includes(',') &&
    // field 12+ not required in bedMethyl, but if it is a string and not a
    // number, not bedMethyl
    (splitLine[12] !== undefined ? !Number.isNaN(+splitLine[12]) : true)
  )
}

export function generateBedMethylFeature({
  splitLine,
  uniqueId,
  refName,
  start,
  end,
}: {
  splitLine: string[]
  uniqueId: string
  refName: string
  start: number
  end: number
}) {
  // see
  // https://github.com/nanoporetech/modkit?tab=readme-ov-file#description-of-bedmethyl-output
  const [
    ,
    ,
    ,
    code,
    ,
    strand,
    ,
    ,
    color,
    n_valid_cov,
    fraction_modified,
    n_mod,
    n_canonical,
    n_other_mod,
    n_delete,
    n_fail,
    n_diff,
    n_nocall,
  ] = splitLine

  return {
    uniqueId,
    refName,
    start,
    end,
    code,
    score: +fraction_modified! || 0,
    strand,
    color,
    source: code,
    n_valid_cov,
    fraction_modified,
    n_mod,
    n_canonical,
    n_other_mod,
    n_delete,
    n_fail,
    n_diff,
    n_nocall,
  }
}
