export function isBedMethylFeature({
  splitLine,
  start,
  end,
}: {
  splitLine: string[]
  start: number
  end: number
}) {
  return +(splitLine[6] || 0) === start && +(splitLine[7] || 0) === end
}
export function generateBedMethylFeature({
  line,
  uniqueId,
  refName,
  start,
  end,
}: {
  line: string
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
  ] = line.split('\t')

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
