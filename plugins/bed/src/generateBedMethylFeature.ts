// this uses modkit bedMethyl. unclear how to reliably detect minimal 9+2 bedMethyl
const BED_METHYL_NUMERIC_COLUMNS = [9, 10, 11, 12, 13, 14, 15, 16, 17] as const
const BED_METHYL_THICK_START_COL = 6
const BED_METHYL_THICK_END_COL = 7

export function isBedMethylFeature({
  splitLine,
  start,
  end,
}: {
  splitLine: string[]
  start: number
  end: number
}) {
  const thickStartMatches =
    +(splitLine[BED_METHYL_THICK_START_COL] || 0) === start
  const thickEndMatches = +(splitLine[BED_METHYL_THICK_END_COL] || 0) === end
  const hasRequiredNumericColumns = BED_METHYL_NUMERIC_COLUMNS.every(
    columnIndex =>
      splitLine[columnIndex] && !Number.isNaN(+splitLine[columnIndex]),
  )

  return thickStartMatches && thickEndMatches && hasRequiredNumericColumns
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
    /* chrom */ /* chromStart */ /* chromEnd */ code,
    ,
    /* name */ strand,
    ,
    ,
    /* thickStart */ /* thickEnd */ color,
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
