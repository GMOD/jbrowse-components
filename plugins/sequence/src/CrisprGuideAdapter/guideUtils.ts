// Cheap, honest triage metrics for a protospacer (in guide 5'->3' orientation):
// GC percent (extreme values hurt on-target efficiency) and a poly-T run, which
// terminates transcription from pol III (U6/H1) promoters and kills the guide.
// These are sequence properties, NOT a specificity/off-target score.
export function guideQuality(guideSeq: string) {
  const seq = guideSeq.toUpperCase()
  let gc = 0
  for (const c of seq) {
    if (c === 'G' || c === 'C') {
      gc += 1
    }
  }
  return {
    gcPercent: seq.length ? Math.round((100 * gc) / seq.length) : 0,
    hasPolyT: seq.includes('TTTT'),
  }
}

export interface GuidePlacement {
  featureStart: number
  featureEnd: number
  pamStart: number
  pamEnd: number
  protoStart: number
  protoEnd: number
  cutSite: number
  // absent when the two strands are cut at the same place (a blunt enzyme), so
  // nothing downstream has to special-case a pair of identical positions
  cutSiteBottom?: number
}

// Given a PAM match on the plus strand at [matchStart, matchStart+pamLength),
// compute the protospacer extent and predicted cut sites for a guide on the
// given strand. Cas9-type enzymes carry the PAM 3' of the protospacer and cut
// both strands at the same offset (blunt); Cas12a-type carry it 5' and cut the
// two strands at different offsets, leaving a staggered 5' overhang. All
// coordinates are absolute plus-strand interbase.
export function placeGuide({
  matchStart,
  pamLength,
  guideLength,
  pamLocation,
  cutOffset,
  cutOffsetBottom,
  strand,
}: {
  matchStart: number
  pamLength: number
  guideLength: number
  pamLocation: string
  cutOffset: number
  cutOffsetBottom: number
  strand: 1 | -1
}): GuidePlacement {
  const pamStart = matchStart
  const pamEnd = matchStart + pamLength
  const isFivePrime = pamLocation === '5prime'

  // the protospacer sits on the low-coordinate side of the PAM for a plus-strand
  // 3' PAM or a minus-strand 5' PAM, and on the high-coordinate side otherwise
  const protoOnLeft =
    (strand === 1 && !isFivePrime) || (strand === -1 && isFivePrime)

  const protoStart = protoOnLeft ? pamStart - guideLength : pamEnd
  const protoEnd = protoOnLeft ? pamStart : pamEnd + guideLength

  // each cut sits its offset in bp into the protospacer from the PAM-proximal end
  const at = (offset: number) =>
    protoOnLeft ? pamStart - offset : pamEnd + offset
  const cutSite = at(cutOffset)
  const cutSiteBottom = at(cutOffsetBottom)

  return {
    featureStart: Math.min(pamStart, protoStart),
    featureEnd: Math.max(pamEnd, protoEnd),
    pamStart,
    pamEnd,
    protoStart,
    protoEnd,
    cutSite,
    ...(cutSiteBottom === cutSite ? {} : { cutSiteBottom }),
  }
}
