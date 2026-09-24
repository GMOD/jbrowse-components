import { parseBreakend } from '@gmod/vcf'

import type { Feature } from './simpleFeature.ts'
import type { Breakend } from '@gmod/vcf'

export const SV_SYMBOLIC_ALLELES = [
  '<TRA',
  '<DEL',
  '<INV',
  '<INS',
  '<DUP',
  '<CNV',
]

/**
 * #api
 * parseBreakend, honoring its `Breakend | undefined` signature. ALT strings are
 * user data and malformed breakends do occur; @gmod/vcf <=7.0.10 throws on them
 * instead of returning undefined, which would otherwise fail a whole render or
 * feature-parse pass over one bad allele. Use this everywhere rather than
 * importing parseBreakend directly; it can become a plain re-export once the
 * upstream fix ships.
 */
export function safeParseBreakend(alt: string) {
  try {
    return parseBreakend(alt)
  } catch {
    return undefined
  }
}

/**
 * #api
 * The mate locString ("chr2:100") of a parsed breakend, or undefined when it
 * names no navigable position. Two ALT forms reach here without one: a single
 * breakend (`.A` / `G.`) has no mate at all, and the symbolic-mate forms
 * (`G<DEL>`, `<DEL>G`) get a placeholder `<DEL>:1` from parseBreakend, which
 * puts a symbolic allele id where a contig name belongs. Callers that navigate
 * or split-view a mate must drop both rather than treat `<DEL>` as a refName.
 */
export function getBreakendMateLocString(breakend?: Breakend) {
  const matePosition = breakend?.MatePosition
  return matePosition === undefined || matePosition.startsWith('<')
    ? undefined
    : matePosition
}

/**
 * #api
 * Parse raw (non-assembly-resolved) mate coordinates from a VCF SV feature+alt.
 * Returns undefined when no mate coordinate info is found.
 */
export function parseSvAlt(
  feature: Feature,
  alt?: string,
):
  | {
      mateRefName: string
      matePos: number // VCF 1-based coordinate
      // Which way the sequence each end KEEPS runs from its breakpoint, as a
      // tick direction (1 = right, -1 = left) — the same convention
      // StarFusionAdapter's `tickDirection` states, since the paired-arc
      // display draws both through one `mateDirection` field.
      mateDirection?: number
      joinDirection?: number
    }
  | undefined {
  const bnd = alt !== undefined ? safeParseBreakend(alt) : undefined
  const mateLocString = getBreakendMateLocString(bnd)
  const refName = feature.get('refName')

  if (alt !== undefined && SV_SYMBOLIC_ALLELES.some(a => alt.startsWith(a))) {
    const info = feature.get('INFO') as
      | Record<string, (string | number)[]>
      | undefined
    const matePos = info?.END?.[0] as number | undefined
    if (matePos === undefined) {
      return undefined
    }
    return {
      mateRefName: (info?.CHR2?.[0] as string | undefined) ?? refName,
      matePos,
    }
  } else if (bnd !== undefined && mateLocString !== undefined) {
    // Split at the LAST colon, the same rule `parseLocString` applies and for
    // the same reason: a refName may contain one. GRCh38's full analysis set
    // names its HLA contigs `HLA-A*01:01:01:01`, so a mate on one arrives here
    // as `HLA-A*01:01:01:01:1000` and splitting at the first colon read the
    // chromosome as `HLA-A*01` and the position as 1.
    const colon = mateLocString.lastIndexOf(':')
    const mateRefName = mateLocString.slice(0, colon)
    const matePosStr = mateLocString.slice(colon + 1)
    const matePos = Number(matePosStr)
    // A position that is not a 1-based coordinate is not a location. Returning
    // one anyway put it through `svMateLocus` into a fetch region and a panel's
    // `centerAt`, neither of which reports anything. `Number` alone is too
    // generous to screen on: it reads `''` as 0 and `'0x10'` as 16.
    if (colon <= 0 || !/^\d+$/.test(matePosStr) || matePos < 1) {
      return undefined
    }
    return { mateRefName, matePos, ...breakendKeepsDirections(bnd) }
  }
  return undefined
}

/**
 * #api
 * Which way the sequence each end of a breakend KEEPS runs from its breakpoint,
 * as `+1 = right` / `-1 = left` — the convention `StarFusionAdapter`'s
 * `tickDirection` states and the one every producer in the tree emits.
 *
 * The two halves read their strings with OPPOSITE polarity, which is the whole
 * reason to state them together. `Join: 'right'` says the mate piece is joined
 * to the RIGHT of the ref base, so this end keeps the sequence to its left:
 * negated. `MateDirection: 'right'` says the mate's own piece extends to the
 * right of the mate position, which is already the direction it keeps: taken as
 * read. So `N[chr2:2000[` is `{ joinDirection: -1, mateDirection: 1 }`, and that
 * is the same pair `StarFusionAdapter` emits for the fusion it describes — the
 * donor keeps the sequence below its breakpoint (-1) and the acceptor the
 * sequence above its own (+1).
 *
 * Split out of `parseSvAlt` because a consumer holding an already-parsed
 * `Breakend` was re-deriving it by hand, in two adjacent ternaries of opposite
 * polarity — the shape that produced 78bb7b84f9.
 */
export function breakendKeepsDirections(bnd: Breakend) {
  return {
    mateDirection: bnd.MateDirection === 'left' ? -1 : 1,
    joinDirection: bnd.Join === 'left' ? 1 : -1,
  }
}

/**
 * #api
 * The structural variant type an ALT allele spells: a symbolic allele's name
 * (`<DEL>` and `<DUP:TANDEM>` give `DEL` and `DUP`), `BND` for a breakend,
 * else undefined.
 */
export function svTypeOfAlt(alt: string | undefined) {
  if (alt === undefined) {
    return undefined
  }
  if (alt.startsWith('<')) {
    const close = alt.search(/[:>]/)
    return close > 1 ? alt.slice(1, close) : undefined
  }
  return safeParseBreakend(alt) ? 'BND' : undefined
}
