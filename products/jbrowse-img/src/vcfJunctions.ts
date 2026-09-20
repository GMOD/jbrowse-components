import { safeParseBreakend } from '@jbrowse/sv-core'

import type { BatchRecord, Locus } from './batch.ts'

// A VCF's SV records, for `batch` to render. The ALT bracket grammar is
// `@gmod/vcf`'s `parseBreakend`, through sv-core's `safeParseBreakend`: a regex
// over the bracket drops the 28 of 66 COLO829 breakends that carry inserted
// sequence. What no library owns is the two file-level facts below: which
// spelling of a contig the file itself uses, and which records are two halves
// of one adjacency.

const CONTIG_ID = /^##contig=<.*ID=([^,>]+)/

// How far apart the two records of one reciprocal breakend pair may place it
// and still count as one junction. It asks whether two records are one
// adjacency written twice, which callers disagree about by a base or two.
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

interface VcfRecord {
  own: Endpoint
  mate?: Endpoint
  id?: string
}

function near(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance
}

/**
 * Collapse the two records of a reciprocal breakend pair into one junction.
 * Each junction is compared against what has already been kept rather than its
 * neighbour, so a run of drifting records cannot chain: 300, 308 and 316 at
 * tolerance 10 keeps the two ends and drops only the middle. A record naming
 * one locus is never a duplicate: two insertions at one position are two calls.
 */
function dedupe(records: VcfRecord[], tolerance: number) {
  const kept: VcfRecord[] = []
  for (const rec of records) {
    const { own: a, mate: b } = rec
    const dup =
      b !== undefined &&
      kept.some(({ own: ka, mate: kb }) => {
        if (!kb) {
          return false
        }
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
      kept.push(rec)
    }
  }
  return kept
}

function breakendMate(alt: string): Endpoint | undefined {
  const mateLoc = safeParseBreakend(alt)?.MatePosition
  // `<DEL>:1` is parseBreakend's placeholder for a symbolic mate
  if (!mateLoc || mateLoc.startsWith('<')) {
    return undefined
  }
  const idx = mateLoc.lastIndexOf(':')
  const ref = mateLoc.slice(0, idx)
  const p = Number(mateLoc.slice(idx + 1))
  return ref && Number.isFinite(p) ? [ref, p] : undefined
}

/**
 * Every SV record a VCF holds, with the loci it is drawn on: both ends of a
 * junction (a breakend's mate, or INFO END on the contig CHR2 names), and the
 * record's own position alone where it names no other end — an insertion, a
 * single breakend. `text` is the decompressed VCF. Rows left out are reported
 * with a reason.
 */
export function parseVcfJunctions(
  text: string,
  { tolerance = DEDUP_TOLERANCE, passOnly = false } = {},
) {
  const skipped: string[] = []
  // The spelling the FILE uses, keyed case-insensitively. Callers upper-case
  // the mate contig in the ALT bracket (`G]CHR3:25359111]`), and `CHR3` is not
  // a region the assembly has, so the panel renders empty rather than failing.
  const contigs = new Map<string, string>()
  const found: VcfRecord[] = []
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
    const [chrom, posStr, id, , alt, , filter, info = ''] = f
    const pos = Number(posStr)
    if (!chrom || !Number.isFinite(pos)) {
      skipped.push(`line ${lineNo}: no usable CHROM/POS`)
      continue
    }
    if (!contigs.has(chrom.toLowerCase())) {
      contigs.set(chrom.toLowerCase(), chrom)
    }
    // `.` is "no filter applied", which is a pass
    if (passOnly && filter && filter !== 'PASS' && filter !== '.') {
      skipped.push(`line ${lineNo}: FILTER is "${filter}", not PASS`)
      continue
    }
    const svtype = infoField(info, 'SVTYPE')
    if (!svtype) {
      skipped.push(`line ${lineNo}: no SVTYPE`)
      continue
    }
    const end = infoField(info, 'END')
    const mate: Endpoint | undefined =
      svtype === 'BND'
        ? alt
          ? breakendMate(alt)
          : undefined
        : end !== undefined && /^\d+$/.test(end)
          ? [infoField(info, 'CHR2') ?? chrom, Number(end)]
          : undefined
    // an insertion's END is its own POS, which is one locus written twice
    const mateIsOwn = mate?.[0] === chrom && mate[1] === pos
    found.push({
      own: [chrom, pos],
      ...(mate && !mateIsOwn ? { mate } : {}),
      ...(id && id !== '.' ? { id } : {}),
    })
  }

  // After the loop: `contigs` is still filling while the records are read, so a
  // mate spelled `CHR3` ahead of the record that establishes `chr3` would stay
  // uncanonical. Before dedupe, which compares contig names.
  const canonical = ([refName, pos]: Endpoint): Endpoint => [
    contigs.get(refName.toLowerCase()) ?? refName,
    pos,
  ]
  // 1-based VCF POS in, 0-based half-open out
  const locus = ([refName, pos]: Endpoint): Locus => ({
    refName,
    start: pos - 1,
    end: pos,
  })
  const records: BatchRecord[] = dedupe(
    found.map(r => ({
      ...r,
      own: canonical(r.own),
      ...(r.mate ? { mate: canonical(r.mate) } : {}),
    })),
    tolerance,
  ).map(({ own, mate, id }, i) => ({
    loci: mate ? [locus(own), locus(mate)] : [locus(own)],
    // the caller's own ID, so an image traces back to the VCF row
    name: id ?? `junction_${i}`,
  }))
  return { records, skipped }
}
