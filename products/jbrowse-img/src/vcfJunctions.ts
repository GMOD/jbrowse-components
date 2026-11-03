import { parseBreakend } from '@gmod/vcf'
import { variantCall } from '@jbrowse/alignments-core/variantSortColumn'

import { SMALL_VARIANT_BP } from './batch.ts'

import type { BatchRecord, CarriedCall, Locus } from './batch.ts'
import type {
  VariantCall,
  VariantSortColumn,
} from '@jbrowse/alignments-core/variantSortColumn'

// parseBreakend comes from `@gmod/vcf`, not sv-core, whose entry point loads
// the UI toolkit.

const CONTIG_ID = /^##contig=<.*ID=([^,>]+)/

// callers place the two halves of a reciprocal pair a base or two apart
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
  span: number
  sort?: VariantSortColumn
  carried?: CarriedCall
  alleleLength?: number
  mate?: Endpoint
  id?: string
  event?: string
  line: number
}

function near(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance
}

// Compared against what was kept, not the neighbour, so drifting records cannot
// chain. A one-locus record is never a duplicate.
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

function safeParseBreakend(alt: string) {
  try {
    return parseBreakend(alt)
  } catch {
    return undefined
  }
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

function symbolicCall(
  pos: number,
  alt?: string,
  inserted = 1,
): VariantCall | undefined {
  return alt === '<DEL>'
    ? { column: { field: 'base', pos }, carried: { base: '*' } }
    : alt === '<INS>'
      ? { column: { field: 'insertion', pos }, carried: { inserted } }
      : undefined
}

// A large deletion needs a gap of half its length, since a few missing bases
// at its first base are in any deep pileup.
function carriedCall({ carried }: VariantCall, deleted: number): CarriedCall {
  return 'base' in carried
    ? carried.base === '*' && deleted >= SMALL_VARIANT_BP
      ? { ...carried, minDeletion: Math.ceil(deleted / 2) }
      : carried
    : {
        minInsertion: Math.max(1, Math.ceil(carried.inserted / 2)),
        anywhere: carried.inserted >= SMALL_VARIANT_BP,
      }
}

/** `text` is the decompressed VCF */
export function parseVcfJunctions(
  text: string,
  { tolerance = DEDUP_TOLERANCE, passOnly = false } = {},
) {
  const skipped: string[] = []
  // Callers upper-case the mate contig in the ALT bracket (`G]CHR3:1]`), which
  // would render an empty panel, so names map to the file's own spelling.
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
    const [chrom, posStr, id, ref = '', alt, , filter, info = ''] = f
    const pos = Number(posStr)
    if (!chrom || !Number.isFinite(pos)) {
      skipped.push(`line ${lineNo}: no usable CHROM/POS`)
      continue
    }
    if (!contigs.has(chrom.toLowerCase())) {
      contigs.set(chrom.toLowerCase(), chrom)
    }
    if (passOnly && filter && filter !== 'PASS' && filter !== '.') {
      skipped.push(`line ${lineNo}: FILTER is "${filter}", not PASS`)
      continue
    }
    const svtype = infoField(info, 'SVTYPE')
    const alts = alt?.split(',') ?? []
    const spelled = variantCall(pos - 1, ref, alts)
    const inserted = Number(
      infoField(info, 'SVINSLEN') ?? infoField(info, 'SVLEN'),
    )
    const call =
      spelled ??
      symbolicCall(
        pos,
        alt,
        Number.isFinite(inserted) ? Math.abs(inserted) : undefined,
      )
    const sort = call?.column
    const end = infoField(info, 'END')
    const svlen = Number(infoField(info, 'SVLEN'))
    const deleted = spelled
      ? ref.length - 1
      : Number.isFinite(svlen)
        ? Math.abs(svlen)
        : Number(end) - pos
    if (!svtype && !sort) {
      skipped.push(`line ${lineNo}: no SVTYPE, and no ALT spelling out bases`)
      continue
    }
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
    const event = infoField(info, 'EVENT')
    found.push({
      own: [chrom, pos],
      span: svtype ? 1 : ref.length,
      line: lineNo,
      ...(call
        ? { sort: call.column, carried: carriedCall(call, deleted) }
        : {}),
      // a symbolic allele spells out no bases, and keeps a junction's flank
      ...(spelled
        ? {
            alleleLength: Math.max(
              ref.length,
              ...alts.filter(a => /^[ACGTN]+$/i.test(a)).map(a => a.length),
            ),
          }
        : {}),
      ...(mate && !mateIsOwn ? { mate } : {}),
      ...(id && id !== '.' ? { id } : {}),
      ...(event ? { event } : {}),
    })
  }

  // after the loop, since `contigs` fills as records are read, and before
  // dedupe, which compares contig names
  const canonical = ([refName, pos]: Endpoint): Endpoint => [
    contigs.get(refName.toLowerCase()) ?? refName,
    pos,
  ]
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
  ).map(
    ({ own, span, sort, carried, alleleLength, mate, id, event, line }) => ({
      loci: mate
        ? [locus(own), locus(mate)]
        : [{ ...locus(own), end: own[1] - 1 + span }],
      line,
      ...(sort ? { sort } : {}),
      ...(alleleLength === undefined ? {} : { alleleLength }),
      ...(carried ? { carried } : {}),
      ...(id ? { name: id } : {}),
      ...(event ? { event } : {}),
    }),
  )
  return { records, skipped, refNames: [...contigs.values()] }
}
