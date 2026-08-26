/**
 * The read-pair signatures Cue's SV contact map is built from, as pure
 * functions over one alignment record.
 *
 * Each channel answers a different question about a pair, and a track shows one
 * of them: `discordant` is every pair whose mates sit far apart plus every
 * split-read segment, `sameStrand` is the inversion signature (LL/RR), and
 * `outward` is the eversion signature (RL). `depthDifference` is not a pair
 * signature at all — it is |depth[a] - depth[b]| over bin pairs, which the
 * adapter builds from the same scan.
 *
 * A pair must produce exactly one contact, and which mate emits it differs by
 * channel. `discordant` and `sameStrand` hold symmetrically for both mates, so
 * the lower-positioned mate emits and first-in-pair breaks a tie. `outward`'s
 * test — a forward read placed past its mate — holds for one mate only, so that
 * read emits and there is no tie to break. Cue's `get_read_pair_type` spells
 * the eversion test as R2F1 alone and carries an upstream TODO about the
 * mirrored spelling it therefore misses; this matches Cue rather than fixing
 * it, so the two agree on a call set.
 */

export const CONTACT_CHANNELS = [
  'discordant',
  'sameStrand',
  'outward',
  'depthDifference',
] as const

export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

const SAM_FLAG_PAIRED = 0x1
const SAM_FLAG_UNMAPPED = 0x4
const SAM_FLAG_MATE_UNMAPPED = 0x8
const SAM_FLAG_MATE_REVERSE = 0x20
const SAM_FLAG_FIRST_IN_PAIR = 0x40
const SAM_FLAG_SECONDARY = 0x100
const SAM_FLAG_SUPPLEMENTARY = 0x800

/** How far past its mate a forward read has to sit to count as everted. */
const EVERSION_SLOP = 5

/**
 * One alignment, in the fields these rules read. `strand` is the feature's own
 * — never re-derived from a flag — and the pairing comes from the SAM flag
 * word, the mate's reference name and position, and the raw `SA` tag.
 */
export interface AlignmentRecord {
  refName: string
  start: number
  end: number
  strand: number
  flags: number
  nextRefName?: string
  nextPos?: number
  sa?: string
}

/** A contact between two positions on one reference, lower position first. */
export interface Contact {
  refName: string
  pos1: number
  pos2: number
}

export interface ChannelOptions {
  channel: ContactChannel
  minSpan: number
}

/** Whether a channel drops cells on the diagonal, where both ends share a bin. */
export function isOffDiagonalOnly(channel: ContactChannel) {
  return channel === 'sameStrand' || channel === 'outward'
}

/** A secondary, supplementary or unmapped record contributes nothing anywhere. */
export function isPrimaryAligned(record: AlignmentRecord) {
  return !(
    record.flags &
    (SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_UNMAPPED)
  )
}

/** The bin a read is counted into for depth: its midpoint's. */
export function depthBin(record: AlignmentRecord, resolution: number) {
  return Math.floor((record.start + record.end) / 2 / resolution)
}

function contact(refName: string, a: number, b: number): Contact {
  return a <= b ? { refName, pos1: a, pos2: b } : { refName, pos1: b, pos2: a }
}

function mateOnSameRef(record: AlignmentRecord) {
  const { flags, nextRefName, nextPos } = record
  return (
    !!(flags & SAM_FLAG_PAIRED) &&
    !(flags & SAM_FLAG_MATE_UNMAPPED) &&
    nextPos !== undefined &&
    (nextRefName === undefined || nextRefName === record.refName)
  )
}

/** Whether this mate is the one that speaks for a symmetric pair signature. */
function emitsForPair(record: AlignmentRecord, nextPos: number) {
  return record.start === nextPos
    ? !!(record.flags & SAM_FLAG_FIRST_IN_PAIR)
    : record.start < nextPos
}

function isSameStrandPair(record: AlignmentRecord) {
  return (record.strand === -1) === !!(record.flags & SAM_FLAG_MATE_REVERSE)
}

/**
 * Split-read segments the `SA` tag lists on the same reference, one contact
 * each. The tag is `rname,pos,strand,CIGAR,mapQ,NM;` repeated, `pos` 1-based.
 */
export function splitContacts(record: AlignmentRecord): Contact[] {
  const { sa, refName, start } = record
  if (!sa) {
    return []
  }
  const out: Contact[] = []
  for (const segment of sa.split(';')) {
    if (!segment) {
      continue
    }
    const [segRefName, segPos] = segment.split(',')
    const pos = Number(segPos)
    if (segRefName === refName && Number.isFinite(pos)) {
      out.push(contact(refName, start, pos - 1))
    }
  }
  return out
}

/** Every contact one record contributes to a channel. */
export function contactsForRecord(
  record: AlignmentRecord,
  { channel, minSpan }: ChannelOptions,
): Contact[] {
  if (!isPrimaryAligned(record)) {
    return []
  }
  const splits = channel === 'discordant' ? splitContacts(record) : []
  if (!mateOnSameRef(record)) {
    return splits
  }
  const { refName, start, strand } = record
  const nextPos = record.nextPos!

  if (channel === 'outward') {
    return !isSameStrandPair(record) &&
      strand === 1 &&
      start > nextPos + EVERSION_SLOP
      ? [contact(refName, start, nextPos)]
      : []
  }
  if (!emitsForPair(record, nextPos)) {
    return splits
  }
  if (channel === 'sameStrand') {
    return isSameStrandPair(record) ? [contact(refName, start, nextPos)] : []
  }
  return Math.abs(start - nextPos) >= minSpan
    ? [...splits, contact(refName, start, nextPos)]
    : splits
}
