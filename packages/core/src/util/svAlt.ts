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

// Read the mate destination from a VCF translocation INFO record. CHR2/END
// give the mate ref+position; STRANDS[0] is a two-char code (e.g. "+-") where
// the first char is this side's strand and the second is the mate's. Returns
// undefined when CHR2/END aren't both present.
export function readTranslocationMate(info: {
  CHR2?: string[]
  END?: number[]
  STRANDS?: string[]
}) {
  const chr = info.CHR2?.[0]
  const pos = info.END?.[0]
  if (chr === undefined || pos === undefined) {
    return undefined
  }
  const [myDir, mateDir] = info.STRANDS?.[0]?.split('') ?? ['.', '.']
  // A STRANDS char names the strand the record is ON, and an end on `+` keeps
  // the sequence to its LEFT — so the keeps-direction (`breakendKeepsDirections`,
  // +1 = right) is its negation. Resolved here so the one consumer that draws
  // these as ticks does not have to know that, which is how the two conventions
  // came to sit a negation apart in the first place.
  const sign = (s: string) => (s === '+' ? -1 : s === '-' ? 1 : 0)
  return {
    chr,
    pos,
    myDir: myDir ?? '.',
    mateDir: mateDir ?? '.',
    myKeepsDir: sign(myDir ?? '.'),
    mateKeepsDir: sign(mateDir ?? '.'),
  }
}

/**
 * One end of a junction: the base beside the join on the side this end keeps,
 * 0-based.
 */
export interface JunctionEnd {
  refName: string
  pos: number
  /** which way the sequence this end keeps runs from it: 1 right, -1 left, 0 unknown */
  keeps: number
}

function keepsOf(mateDirection: unknown, strand: unknown) {
  if (typeof mateDirection === 'number') {
    return mateDirection
  }
  // a BEDPE strand names the side of the block the junction is on: `+` its
  // end, so the block keeps the sequence to its left
  return strand === 1 ? -1 : strand === -1 ? 1 : 0
}

function joinBase(
  self: { start: number; end: number; keeps: number },
  other: { start: number; end: number },
) {
  const keeps =
    self.keeps || (self.start + self.end <= other.start + other.end ? -1 : 1)
  return keeps === -1 ? self.end - 1 : self.start
}

function symbolicKeeps(feature: Feature, alt: string) {
  if (alt.startsWith('<DEL')) {
    return [-1, 1] as const
  }
  if (alt.startsWith('<DUP')) {
    return [1, -1] as const
  }
  const tra = readTranslocationMate(
    (feature.get('INFO') as
      | Parameters<typeof readTranslocationMate>[0]
      | undefined) ?? {},
  )
  return [tra?.myKeepsDir ?? 0, tra?.mateKeepsDir ?? 0] as const
}

/**
 * #api
 * Where a paired record's junction is at each of its two ends, and which side
 * of it each end keeps — the one answer every launcher, the row menu and the
 * chain walk take, whether the record is a VCF breakend, a symbolic SV or a
 * paired adapter's row (BEDPE, STAR-Fusion). Refnames are as the record spells
 * them. `undefined` for a record naming no other end. A VCF record is read
 * through `alt`, its first ALT unless the caller names another.
 *
 * A VCF end is its own position. A paired adapter's end is a block, and the
 * junction is the block's edge on the side the end keeps: stated by
 * `mateDirection` where the adapter knows it, read off a BEDPE strand
 * otherwise, and with neither the two blocks face each other.
 */
export function junctionEnds(
  feature: Feature,
  alt = (feature.get('ALT') as string[] | undefined)?.[0],
): { own: JunctionEnd; mate: JunctionEnd } | undefined {
  const refName = feature.get('refName')
  const mate = feature.get('mate') as
    | {
        refName?: string
        start?: number
        end?: number
        mateDirection?: number
        strand?: number
      }
    | undefined
  if (mate?.refName !== undefined && mate.start !== undefined) {
    const self = {
      start: feature.get('start'),
      end: feature.get('end'),
      keeps: keepsOf(feature.get('mateDirection'), feature.get('strand')),
    }
    const far = {
      start: mate.start,
      end: mate.end ?? mate.start + 1,
      keeps: keepsOf(mate.mateDirection, mate.strand),
    }
    return {
      own: { refName, pos: joinBase(self, far), keeps: self.keeps },
      mate: {
        refName: mate.refName,
        pos: joinBase(far, self),
        keeps: far.keeps,
      },
    }
  }
  const parsed = parseSvAlt(feature, alt)
  if (!parsed || alt === undefined) {
    return undefined
  }
  const [ownKeeps, mateKeeps] =
    parsed.joinDirection === undefined
      ? symbolicKeeps(feature, alt)
      : [parsed.joinDirection, parsed.mateDirection ?? 0]
  return {
    own: { refName, pos: feature.get('start'), keeps: ownKeeps },
    mate: {
      refName: parsed.mateRefName,
      pos: parsed.matePos - 1,
      keeps: mateKeeps,
    },
  }
}
