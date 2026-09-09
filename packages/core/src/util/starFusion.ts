export type FusionBreakpoint = {
  refName: string
  start: number
  end: number
  strand?: number
  /** which way the sequence this end keeps runs from it: 1 right, -1 left, 0 unknown */
  mateDirection: number
}

/**
 * The column names of a STAR-Fusion `fusion_predictions.tsv` header line. The
 * leading `#` is not universal across STAR-Fusion versions and wrappers, so it
 * is stripped when present. Throws a named error for a header without the two
 * breakpoint columns, which is the wrong file or the wrong File Type guess.
 */
export function starFusionColumns(header: string | undefined) {
  const columns =
    (header?.startsWith('#') ? header.slice(1) : header)?.split('\t') ?? []
  const missing = ['LeftBreakpoint', 'RightBreakpoint'].filter(
    c => !columns.includes(c),
  )
  if (missing.length) {
    throw new Error(
      `Not a STAR-Fusion file: no ${missing.join(' or ')} column. Found: ${columns.slice(0, 6).join(', ')}`,
    )
  }
  return columns
}

/**
 * A STAR-Fusion `refName:pos:strand` breakpoint as an interbase feature, read
 * from the RIGHT because a refName may contain colons (GRCh38's
 * `HLA-A*01:01:01:01`). The position is 1-based in the file. The strand is the
 * gene's transcription strand, and the fusion transcript keeps the donor's
 * sequence 5' of the junction and the acceptor's 3' of it, so `mateDirection`
 * is the strand negated for a donor and taken as read for an acceptor: the
 * convention `parseSvAlt` states for a breakend and the paired-arc display
 * draws its ticks from.
 */
export function parseStarFusionBreakpoint(
  str: string,
  isDonor: boolean,
): FusionBreakpoint {
  const parts = str.split(':')
  const strandStr = parts.length >= 3 ? parts.pop() : undefined
  const pos = parts.length >= 2 ? +parts.pop()! : Number.NaN
  const strand = strandStr === '+' ? 1 : strandStr === '-' ? -1 : undefined
  return {
    refName: parts.join(':'),
    start: pos - 1,
    end: pos,
    strand,
    mateDirection: strand === undefined ? 0 : isDonor ? -strand : strand,
  }
}
