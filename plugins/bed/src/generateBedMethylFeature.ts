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
  if (
    splitLine.length < 18 ||
    +splitLine[6]! !== start ||
    +splitLine[7]! !== end
  ) {
    return false
  }
  // columns 9-17 are the nine numeric methylation stats
  for (let i = 9; i < 18; i++) {
    const x = splitLine[i]!
    if (!x || Number.isNaN(+x)) {
      return false
    }
  }
  return true
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
