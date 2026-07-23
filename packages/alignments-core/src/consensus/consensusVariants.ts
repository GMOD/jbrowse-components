import { walkConsensus } from './computeConsensus.ts'

import type { ConsensusOptions, ConsensusTally } from './computeConsensus.ts'

export interface ConsensusVariant {
  pos: number // 0-based genomic anchor position
  ref: string
  alt: string
  depth: number
  af: number
  type: 'snv' | 'ins' | 'del'
}

function upper(code: number) {
  return code ? String.fromCharCode(code).toUpperCase() : ''
}

const SIMPLE_BASES = new Set(['A', 'C', 'G', 'T'])

// Second projection over the same per-column pass as computeConsensus: every
// position where the consensus call differs from the reference becomes a
// variant. SNVs are single-base; deletion runs coalesce into one left-anchored
// record; insertions anchor on the preceding reference base. N and IUPAC
// ambiguity-code (no confident single-base call) positions are not variants —
// a VCF ALT must be a definite base. This is a consensus-vs-reference diff with
// DP/AF, not genotype-likelihood variant calling.
//
// AF differs by kind on purpose. SNVs and deletions report the samtools
// weighted call-fraction (callScore/tscore) — the same ratio that had to clear
// callFract for the call, so it comes straight from the shared pass and is
// always >= callFract. A multi-base insertion has no single column score, so
// its AF is the supporting-read fraction (reads inserting here / depth).
export function computeConsensusVariants(
  reference: string,
  tally: ConsensusTally,
  opts: ConsensusOptions = {},
) {
  const variants: ConsensusVariant[] = []

  let prevRefBase = ''
  let prevRefPos = -1

  let delOpen = false
  let delAnchorPos = -1
  let delAnchorBase = ''
  let delBases = ''
  let delDepth = 0
  let delScore = 0
  let delTscore = 0

  const closeDel = () => {
    if (delOpen) {
      variants.push({
        pos: delAnchorPos,
        ref: delAnchorBase + delBases,
        alt: delAnchorBase,
        depth: delDepth,
        af: delTscore ? delScore / delTscore : 0,
        type: 'del',
      })
      delOpen = false
    }
  }

  walkConsensus(
    reference,
    tally,
    opts,
    (refPos, refCode, call, depth, callScore, tscore, ins) => {
      const refBase = upper(refCode)

      if (call === '*') {
        if (delOpen) {
          delBases += refBase
        } else if (prevRefBase) {
          delOpen = true
          delAnchorPos = prevRefPos
          delAnchorBase = prevRefBase
          delBases = refBase
          delDepth = depth
          delScore = callScore
          delTscore = tscore
        }
      } else {
        closeDel()
        if (SIMPLE_BASES.has(call) && refBase && call !== refBase) {
          variants.push({
            pos: refPos,
            ref: refBase,
            alt: call,
            depth,
            af: tscore ? callScore / tscore : 0,
            type: 'snv',
          })
        }
      }

      if (ins && refBase) {
        const insReads = tally.insertionAfter.get(refPos)?.length ?? 0
        variants.push({
          pos: refPos,
          ref: refBase,
          alt: refBase + ins,
          depth,
          af: depth ? insReads / depth : 0,
          type: 'ins',
        })
      }

      prevRefBase = refBase
      prevRefPos = refPos
    },
  )
  closeDel()

  return variants
}

export interface ConsensusVcfEntry {
  refName: string
  variants: ConsensusVariant[]
}

export function variantsToVcf(entries: ConsensusVcfEntry[]) {
  // Merge entries by refName (a rubber-band can span several blocks of the same
  // refName) so each contig appears once and its records are position-sorted.
  const byRef = new Map<string, ConsensusVariant[]>()
  for (const { refName, variants } of entries) {
    const arr = byRef.get(refName)
    if (arr) {
      arr.push(...variants)
    } else {
      byRef.set(refName, [...variants])
    }
  }

  const lines = [
    '##fileformat=VCFv4.3',
    '##source=jbrowse-consensus',
    '##INFO=<ID=DP,Number=1,Type=Integer,Description="Read depth at the site">',
    '##INFO=<ID=AF,Number=A,Type=Float,Description="Consensus allele fraction">',
    '##INFO=<ID=TYPE,Number=1,Type=String,Description="snv, ins, or del">',
  ]
  for (const refName of byRef.keys()) {
    lines.push(`##contig=<ID=${refName}>`)
  }
  lines.push('#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO')
  for (const [refName, variants] of byRef) {
    variants.sort((a, b) => a.pos - b.pos)
    for (const v of variants) {
      lines.push(
        `${refName}\t${v.pos + 1}\t.\t${v.ref}\t${v.alt}\t.\t.\tDP=${v.depth};AF=${v.af.toFixed(3)};TYPE=${v.type}`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}
