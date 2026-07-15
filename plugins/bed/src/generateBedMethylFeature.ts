import { parseStrand } from './util.ts'

// this uses modkit bedMethyl. unclear how to reliably detect minimal 9+2 bedMethyl
export function isBedMethylFeature({
  splitLine,
  start,
  end,
}: {
  splitLine: string[]
  start: number
  end: number
}) {
  // columns 9-17 are the nine numeric methylation stats
  const nums = splitLine.slice(9, 18)
  return (
    splitLine[6] !== undefined &&
    +splitLine[6] === start &&
    splitLine[7] !== undefined &&
    +splitLine[7] === end &&
    nums.length === 9 &&
    nums.every(x => x && !Number.isNaN(+x))
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
  const code = splitLine[3]
  const strandRaw = splitLine[5]
  const color = splitLine[8]
  const [
    n_valid_cov,
    fraction_modified,
    n_mod,
    n_canonical,
    n_other_mod,
    n_delete,
    n_fail,
    n_diff,
    n_nocall,
  ] = splitLine.slice(9)

  return {
    uniqueId,
    refName,
    start,
    end,
    code,
    score: +fraction_modified!,
    strand: parseStrand(strandRaw),
    color,
    // source mirrors code so MultiQuantitativeTrack groups by modification code
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
