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

// VCF 4.5 computes END rather than storing it: a DEL, DUP, INV or CNV allele
// ends |SVLEN| bases past POS, SVLEN one value per ALT (one for all in files
// older than 4.4)
function spannedEnd(
  feature: Feature,
  alt: string,
  svlen: unknown,
  alleleIndex: number,
) {
  if (!/^<(DEL|DUP|INV|CNV)[:>]/.test(alt) || !Array.isArray(svlen)) {
    return undefined
  }
  const len = Math.abs(
    Number(svlen.length === 1 ? svlen[0] : svlen[alleleIndex]),
  )
  return len > 0 ? feature.get('start') + 1 + len : undefined
}

/**
 * #api
 * Parse raw (non-assembly-resolved) mate coordinates from a VCF SV feature+alt.
 * Returns undefined when no mate coordinate info is found. `alleleIndex` is
 * the alt's place in `ALT`, which a record repeating one symbolic allele with
 * several lengths needs; it defaults to the first place `alt` appears.
 */
export function parseSvAlt(
  feature: Feature,
  alt?: string,
  alleleIndex = Math.max(
    0,
    (feature.get('ALT') as string[] | undefined)?.indexOf(alt ?? '') ?? 0,
  ),
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
    const matePos =
      (info?.END?.[0] as number | undefined) ??
      spannedEnd(feature, alt, info?.SVLEN, alleleIndex)
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
 * Breakend notation, without parsing it: bracket forms (`G[chr2:100[`), single
 * breakends (`.A` / `G.`), and the symbolic-mate form (`G<DEL>`, an angle
 * bracket past position 0; a leading `<` is a plain symbolic allele).
 */
export function isBreakend(alt: string) {
  return (
    alt.includes('[') ||
    alt.includes(']') ||
    alt.startsWith('.') ||
    alt.endsWith('.') ||
    alt.lastIndexOf('<') > 0
  )
}

/**
 * #api
 * The structural-variant classes, in key order. `OTHER` is a token no class
 * names, or a record whose alleles disagree.
 */
export const SV_CLASSES = [
  'DEL',
  'DUP',
  'INS',
  'INV',
  'CNV',
  'TR',
  'BND',
  'CPX',
  'OTHER',
] as const

/**
 * #api
 * The conventional size floor for calling a sequence indel structural.
 */
export const SV_MIN_LENGTH = 50

const CLASS_OF_TOKEN: Readonly<Record<string, string>> = {
  DEL: 'DEL',
  DUP: 'DUP',
  INS: 'INS',
  INV: 'INV',
  CNV: 'CNV',
  TR: 'TR',
  VNTR: 'TR',
  BND: 'BND',
  TRA: 'BND',
  CTX: 'BND',
  CPX: 'CPX',
  INVDUP: 'CPX',
  CHROMOTHRIPSIS: 'CPX',
  CHROMOPLEXY: 'CPX',
  BFB: 'CPX',
  DOUBLEMINUTE: 'CPX',
}

// gVCF's `<NON_REF>` and bcftools mpileup's `<*>` stand for whatever allele
// the caller did not name, not for a structure.
const ANY_OTHER_ALLELE = new Set(['<NON_REF>', '<*>'])

/**
 * #api
 * The class a symbolic allele id, `SVTYPE` or `EVENTTYPE` names. A subtype folds
 * into its first level (`DEL:ME:ALU` is DEL, `DUP:TANDEM` DUP), except the
 * tandem repeats VCF 4.4 spells `CNV:TR` and ExpansionHunter `STRn`, and the
 * inverted duplication `INV:DUP`. 1000 Genomes' `CNn` counts one haplotype's
 * copies, so none is a deletion and two or more a duplication. `''` for an
 * empty or missing token.
 */
export function svClassOfToken(raw: string) {
  const token = raw.trim().toUpperCase()
  if (token === '' || token === '.') {
    return ''
  }
  if (token === 'CNV:TR') {
    return 'TR'
  }
  if (token === 'INV:DUP') {
    return 'CPX'
  }
  const first = token.split(':')[0]!
  const copies = /^CN(\d+)$/.exec(first)
  if (copies) {
    const n = Number(copies[1])
    return n === 0 ? 'DEL' : n === 1 ? 'CNV' : 'DUP'
  }
  return /^STR\d*$/.test(first) ? 'TR' : (CLASS_OF_TOKEN[first] ?? 'OTHER')
}

// an INFO token one allele states: its own entry of a Number=A field, or the
// one entry a record-wide field has
function alleleToken(
  info: Record<string, unknown> | undefined,
  key: string,
  alleleIndex: number,
) {
  const value = info?.[key]
  const list = Array.isArray(value) ? value : [value]
  const token = list.length === 1 ? list[0] : list[alleleIndex]
  return typeof token === 'string' ? token : ''
}

/**
 * #api
 * The structural-variant class one ALT allele states, `''` for one that is not
 * structural. A symbolic allele's own id wins. Otherwise VCF 4.4's `EVENTTYPE`
 * does; then a breakend is the class its `SVTYPE` declares where that says more
 * than BND, and a sequence allele is an insertion or deletion by its length
 * against REF, else its `SVTYPE`'s class.
 */
export function svClassOfAlt(
  alt: string,
  {
    ref,
    info,
    alleleIndex = 0,
  }: {
    ref?: string
    info?: Record<string, unknown>
    alleleIndex?: number
  } = {},
) {
  if (ANY_OTHER_ALLELE.has(alt)) {
    return ''
  }
  if (alt.startsWith('<') && alt.endsWith('>')) {
    return svClassOfToken(alt.slice(1, -1))
  }
  const event = svClassOfToken(alleleToken(info, 'EVENTTYPE', alleleIndex))
  if (event) {
    return event
  }
  const declared = svClassOfToken(alleleToken(info, 'SVTYPE', alleleIndex))
  if (isBreakend(alt)) {
    return declared && declared !== 'BND' && declared !== 'OTHER'
      ? declared
      : 'BND'
  }
  const diff = alt.length - (ref?.length ?? alt.length)
  return diff >= SV_MIN_LENGTH
    ? 'INS'
    : diff <= -SV_MIN_LENGTH
      ? 'DEL'
      : declared
}

/**
 * #api
 * The structural-variant class of a VCF record as a whole: the one class its
 * alleles state, CNV where they are losses and gains of one segment, OTHER
 * where they otherwise disagree, and `''` for a record with no structural
 * allele.
 */
export function svClassOf(feature: Feature) {
  const alts = feature.get('ALT') as string[] | undefined
  const ref = feature.get('REF') as string | undefined
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  if (!alts?.length) {
    return svClassOfToken(alleleToken(info, 'SVTYPE', 0))
  }
  const classes = new Set<string>()
  for (const [alleleIndex, alt] of alts.entries()) {
    const found = svClassOfAlt(alt, { ref, info, alleleIndex })
    if (found) {
      classes.add(found)
    }
  }
  const [only, ...rest] = classes
  return rest.length === 0
    ? (only ?? '')
    : [...classes].every(c => c === 'DEL' || c === 'DUP' || c === 'CNV')
      ? 'CNV'
      : 'OTHER'
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

// A BEDPE strand names the side of the block the junction is on: `+` its end,
// so the block keeps the sequence to its left.
function keepsOf(mateDirection: unknown, strand: unknown) {
  if (typeof mateDirection === 'number') {
    return mateDirection
  }
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
 * `mateDirection` where the adapter knows it, read off the strands where the
 * record states one for each end as BEDPE does, and with neither the two
 * blocks face each other. A PAF row's strand is the query's orientation and
 * states none for the target, so it names no side.
 */
export function junctionEnds(
  feature: Feature,
  alt = (feature.get('ALT') as string[] | undefined)?.[0],
  alleleIndex?: number,
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
    const sided = mate.strand !== undefined
    const self = {
      start: feature.get('start'),
      end: feature.get('end'),
      keeps: keepsOf(
        feature.get('mateDirection'),
        sided ? feature.get('strand') : undefined,
      ),
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
  const parsed = parseSvAlt(feature, alt, alleleIndex)
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
