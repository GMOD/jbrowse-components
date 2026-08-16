import { safeParseBreakend } from '@jbrowse/sv-core'

import type { BedpeRecord } from './batch.ts'

// A VCF's junctions, for `batch` to render. The BEDPE path stays the interchange
// format; this is the shortcut for the case every caller actually produces.
//
// **The ALT grammar is delegated to `@gmod/vcf`'s `parseBreakend`**, through
// sv-core's `safeParseBreakend` wrapper, and that is the whole reason this file
// is allowed to exist. A regex over the bracket is what silently drops the 28
// of 66 COLO829 breakends that carry inserted sequence, and it is what this repo
// has already been bitten by twice. The library handles inserted sequence,
// assembly-contig mate positions and single breakends, and is regression-tested
// upstream for the multi-base case.
//
// What is NOT delegated, because no library owns it, is the pair of file-level
// facts below: which spelling of a contig the file itself uses, and which
// records are two halves of one adjacency. Both are checked against
// `scripts/sv_multihop.py bedpe` over the real COLO829 callset, which must agree
// junction for junction.

const CONTIG_ID = /^##contig=<.*ID=([^,>]+)/
// SVTYPEs that name a second locus on the same contig via INFO END. INS is
// deliberately absent: it names one locus, so there is no second panel.
const SYMBOLIC_WITH_END = new Set(['DEL', 'DUP', 'INV'])

// How far apart the two records of one reciprocal breakend pair may place it and
// still count as one junction. Small on purpose, and NOT a "are these related"
// threshold: it asks whether two records are one adjacency written twice, which
// callers disagree about by a base or two at most. Matches sv_multihop.py's
// DEDUP_TOLERANCE so the two produce the same junction list.
const DEDUP_TOLERANCE = 10

function infoField(info: string, key: string) {
  for (const field of info.split(';')) {
    if (field.startsWith(`${key}=`)) {
      return field.slice(key.length + 1)
    }
  }
  return undefined
}

type Endpoint = [string, number]

// A junction plus the label to file it under: the record's own ID column when it
// has one, so an image can be traced back to the VCF row that produced it.
interface Junction {
  a: Endpoint
  b: Endpoint
  id?: string
}

function near(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance
}

/**
 * Collapse the two records of a reciprocal breakend pair into one junction.
 *
 * Each kept junction is compared against what has already been kept rather than
 * against its neighbour, so a run of drifting records cannot chain: 300, 308 and
 * 316 at tolerance 10 keeps the two ends and drops only the middle. Same rule as
 * `sv_multihop.dedupe_junctions`, and it is a rule rather than a detail because
 * the failure is silent - every translocation queued twice reads as a callset
 * with twice as many events.
 */
function dedupe(junctions: Junction[], tolerance: number) {
  const kept: Junction[] = []
  for (const j of junctions) {
    const { a, b } = j
    const dup = kept.some(({ a: ka, b: kb }) => {
      const same =
        ka[0] === a[0] &&
        kb[0] === b[0] &&
        near(ka[1], a[1], tolerance) &&
        near(kb[1], b[1], tolerance)
      const flipped =
        ka[0] === b[0] &&
        kb[0] === a[0] &&
        near(ka[1], b[1], tolerance) &&
        near(kb[1], a[1], tolerance)
      return same || flipped
    })
    if (!dup) {
      kept.push(j)
    }
  }
  return kept
}

/**
 * Every junction a VCF describes, as BEDPE-shaped records.
 *
 * `text` is the decompressed VCF. Rows that name no second locus (an insertion,
 * a single breakend, a symbolic record with no END) are reported as skipped
 * rather than dropped in silence, for the same reason the BEDPE reader reports
 * its own: a run that quietly rendered 80 of 100 junctions is the failure this
 * workflow exists to prevent.
 */
export function parseVcfJunctions(
  text: string,
  { tolerance = DEDUP_TOLERANCE, passOnly = false } = {},
) {
  const skipped: string[] = []
  // The spelling the FILE uses, keyed case-insensitively. Callers upper-case the
  // mate contig in the ALT bracket (`G]CHR3:25359111]`), and `CHR3` is not a
  // region the assembly has - the panel then renders empty rather than failing.
  // Lower-casing instead reaches only this case and breaks every assembly not
  // spelled in lower case, which is the bug sv_multihop.py records having had.
  const contigs = new Map<string, string>()
  const junctions: Junction[] = []
  let lineNo = 0

  for (const rawLine of text.split('\n')) {
    lineNo++
    const line = rawLine.trimEnd()
    if (line.startsWith('#')) {
      const m = CONTIG_ID.exec(line)
      if (m?.[1] && !contigs.has(m[1].toLowerCase())) {
        contigs.set(m[1].toLowerCase(), m[1])
      }
      continue
    }
    if (!line) {
      continue
    }
    const f = line.split('\t')
    if (f.length < 8) {
      skipped.push(`line ${lineNo}: fewer than 8 columns`)
      continue
    }
    const [chrom, posStr, id, , alt, , filter, info] = f
    const pos = Number(posStr)
    if (!chrom || !Number.isFinite(pos)) {
      skipped.push(`line ${lineNo}: no usable CHROM/POS`)
      continue
    }
    if (!contigs.has(chrom.toLowerCase())) {
      contigs.set(chrom.toLowerCase(), chrom)
    }
    // An unfiltered callset is mostly rows nobody wants pictures of, and --limit
    // takes the first N in FILE order, which is not the first N worth looking at.
    // `.` is "no filter applied", which is a pass rather than a fail.
    if (passOnly && filter && filter !== 'PASS' && filter !== '.') {
      skipped.push(`line ${lineNo}: FILTER is "${filter}", not PASS`)
      continue
    }
    const svtype = infoField(info ?? '', 'SVTYPE')
    let mate: Endpoint | undefined
    if (svtype === 'BND') {
      const bnd = alt ? safeParseBreakend(alt) : undefined
      const mateLoc = bnd?.MatePosition
      // `<DEL>:1` is parseBreakend's placeholder for a symbolic mate, i.e. a
      // symbolic allele id where a contig name belongs
      if (mateLoc && !mateLoc.startsWith('<')) {
        const idx = mateLoc.lastIndexOf(':')
        const ref = mateLoc.slice(0, idx)
        const p = Number(mateLoc.slice(idx + 1))
        if (ref && Number.isFinite(p)) {
          mate = [ref, p]
        }
      }
    } else if (svtype && SYMBOLIC_WITH_END.has(svtype)) {
      const end = infoField(info ?? '', 'END')
      // CHR2 when the caller writes one, else the record's own contig
      const chr2 = infoField(info ?? '', 'CHR2')
      if (end !== undefined && /^\d+$/.test(end)) {
        mate = [chr2 ?? chrom, Number(end)]
      }
    }
    if (!mate) {
      skipped.push(
        `line ${lineNo}: names no second locus (${svtype ?? 'no SVTYPE'})`,
      )
      continue
    }
    junctions.push({
      a: [chrom, pos],
      b: mate,
      ...(id && id !== '.' ? { id } : {}),
    })
  }

  // Canonicalized after the loop, not inside it. `contigs` is still being filled
  // while the records are read, so a mate contig spelled `CHR3` in a file whose
  // header names no contigs stayed uncanonical whenever it appeared BEFORE the
  // record that establishes `chr3` — the empty-panel failure this map exists to
  // prevent, reintroduced by reading the map too early. Before dedupe, which
  // compares contig names.
  const canonical = (e: Endpoint): Endpoint => [
    contigs.get(e[0].toLowerCase()) ?? e[0],
    e[1],
  ]
  const canonicalized = junctions.map(j => ({
    ...j,
    a: canonical(j.a),
    b: canonical(j.b),
  }))

  const records: BedpeRecord[] = dedupe(canonicalized, tolerance).map(
    ({ a, b, id }, i) => ({
      refName1: a[0],
      // 1-based VCF POS in, 0-based half-open BEDPE out
      start1: a[1] - 1,
      end1: a[1],
      refName2: b[0],
      start2: b[1] - 1,
      end2: b[1],
      // The caller's own ID, so an image traces back to the VCF row. Falls back
      // to an index only when the file supplies none — `junction_N` alongside
      // outputName's own leading index was the same number twice, off by one
      // from itself, and said nothing a filename did not already say.
      name: id ?? `junction_${i}`,
    }),
  )
  return { records, skipped }
}
