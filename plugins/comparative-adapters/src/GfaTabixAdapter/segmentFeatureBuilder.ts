import type { SegRecord } from './gfaBinaryIO.ts'
import type { MultiPairFeature } from '../MultiPairFeature.ts'

export function buildFeaturesForPath(
  segments: SegRecord[],
  refByOrd: Map<number, SegRecord>,
  genomeName: string,
  refName: string,
  mateRefName: string,
  otherPath: string,
) {
  const matched: { seg: SegRecord; refSeg: SegRecord }[] = []
  for (const seg of segments) {
    const refSeg = refByOrd.get(seg.segOrd)
    if (refSeg) {
      matched.push({ seg, refSeg })
    }
  }
  if (matched.length === 0) {
    return []
  }
  matched.sort((a, b) => a.refSeg.offset - b.refSeg.offset)

  const features: MultiPairFeature[] = []
  let ms = -1
  let me = -1
  let mms = -1
  let mme = -1
  let mStrand = 0
  let mOrd = -1
  let matchBp = 0
  let cigarParts: string[] = []
  let runMatchLen = 0

  function flush() {
    if (runMatchLen > 0) {
      cigarParts.push(`${runMatchLen}=`)
      matchBp += runMatchLen
    }
    if (ms >= 0) {
      features.push({
        queryGenome: genomeName,
        origRefName: refName,
        start: ms,
        end: me,
        mateStart: mms,
        mateEnd: mme,
        mateRefName,
        strand: mStrand,
        syriType: undefined,
        identity: me > ms ? matchBp / (me - ms) : 1,
        featureId: `gfa-${mOrd}-${otherPath}`,
        segmentId: undefined,
        cigar: cigarParts.length > 1 ? cigarParts.join('') : undefined,
        cs: undefined,
      })
    }
    cigarParts = []
    matchBp = 0
    runMatchLen = 0
  }

  for (const { seg, refSeg } of matched) {
    const strand = seg.orient === refSeg.orient ? 1 : -1
    const rs = refSeg.offset
    const re = refSeg.offset + refSeg.segLen
    const qs = seg.offset
    const qe = seg.offset + seg.segLen

    const canExtend = ms >= 0 && strand === mStrand
    const refGap = canExtend ? rs - me : -1
    const queryGap = canExtend ? (mStrand === 1 ? qs - mme : mms - qe) : -1

    if (!canExtend || refGap < 0 || queryGap < 0) {
      flush()
      ms = rs
      me = re
      mms = qs
      mme = qe
      mStrand = strand
      mOrd = refSeg.segOrd
      runMatchLen = refSeg.segLen
      continue
    }

    if (refGap > 0 || queryGap > 0) {
      if (runMatchLen > 0) {
        cigarParts.push(`${runMatchLen}=`)
        matchBp += runMatchLen
        runMatchLen = 0
      }
      if (refGap > 0 && refGap === queryGap) {
        // Equal-length swap of segments — SNV-like. Emit X (mismatch run)
        // so bubbleOverlay can substitute per-base detail from the bubbles
        // index. Without this, alt-allele SNVs would be 1D1I pairs and the
        // overlay would silently drop the *xy ops because they fall inside
        // D regions. See agent-docs/GRAPH_ARCHITECTURE.md "Fragile
        // boundaries" — this contract is gated by buildCsFromCigarAndSites
        // tests.
        cigarParts.push(`${refGap}X`)
      } else {
        if (refGap > 0) {
          cigarParts.push(`${refGap}D`)
        }
        if (queryGap > 0) {
          cigarParts.push(`${queryGap}I`)
        }
      }
    }

    runMatchLen += refSeg.segLen
    me = re
    if (mStrand === 1) {
      mme = qe
    } else {
      mms = qs
    }
  }

  flush()
  return features
}
