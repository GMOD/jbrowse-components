import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

import { proteinRangeToGenome } from 'g2p_mapper'

import type { Feat } from 'g2p_mapper'

export interface CodingTranscript extends Feat {
  id: string
  strand: 1 | -1
  subfeatures: Feat[]
}

export interface ProteinCall {
  protein: string
  start: number
  end: number
  accession: string
  name: string
  description: string
  source: string
  evalue: string
}

export async function* readLines(file: string) {
  const raw = createReadStream(file)
  const input = /\.b?gz$/i.test(file) ? raw.pipe(createGunzip()) : raw
  yield* createInterface({ input, crlfDelay: Infinity })
}

function gff3Attributes(column: string) {
  const attrs = new Map<string, string[]>()
  for (const pair of column.split(';')) {
    const eq = pair.indexOf('=')
    if (eq > 0) {
      attrs.set(
        pair.slice(0, eq).trim(),
        pair
          .slice(eq + 1)
          .split(',')
          .map(v => decodeURIComponent(v.trim())),
      )
    }
  }
  return attrs
}

function gtfAttributes(column: string) {
  const attrs = new Map<string, string[]>()
  for (const m of column.matchAll(/(\S+)\s+"([^"]*)"/g)) {
    attrs.set(m[1]!, [m[2]!])
  }
  return attrs
}

const withoutPrefix = (id: string) =>
  id.replace(/^(cds|rna|transcript|CDS)[-:]/, '')
const withoutVersion = (id: string) => id.replace(/\.\d+$/, '')

/**
 * Every spelling a protein FASTA might use for a transcript's product: the
 * transcript ID (gffread, funannotate, BRAKER), the CDS's `protein_id` (NCBI,
 * Ensembl) or its ID, each also without an Ensembl/NCBI `type:`/`type-`
 * prefix and without a `.N` version.
 */
function proteinKeys(ids: string[]) {
  return new Set(
    ids.flatMap(id => {
      const bare = withoutPrefix(id)
      return [id, bare, withoutVersion(id), withoutVersion(bare)]
    }),
  )
}

/** Reads the CDS rows of a GFF3 or GTF into coding transcripts, keyed by every name their protein might go by. */
export async function readCodingTranscripts(file: string) {
  const byTranscript = new Map<
    string,
    { transcript: CodingTranscript; aliases: string[] }
  >()
  for await (const line of readLines(file)) {
    const cols = line.split('\t')
    if (line.startsWith('#') || cols.length < 9 || cols[2] !== 'CDS') {
      continue
    }
    const isGtf = /^\s*\w+\s+"/.test(cols[8]!)
    const attrs = isGtf ? gtfAttributes(cols[8]!) : gff3Attributes(cols[8]!)
    const parents = attrs.get(isGtf ? 'transcript_id' : 'Parent') ?? []
    const aliases = [
      ...(attrs.get('protein_id') ?? []),
      ...(isGtf ? [] : (attrs.get('ID') ?? [])),
    ]
    const cds = {
      refName: cols[0]!,
      start: +cols[3]! - 1,
      end: +cols[4]!,
      type: 'CDS',
      phase: cols[7] === '.' ? 0 : +cols[7]!,
    }
    for (const parent of parents) {
      const entry = byTranscript.get(parent) ?? {
        transcript: {
          id: parent,
          refName: cds.refName,
          start: cds.start,
          end: cds.end,
          strand: cols[6] === '-' ? -1 : 1,
          subfeatures: [],
        },
        aliases: [],
      }
      byTranscript.set(parent, entry)
      const { transcript } = entry
      transcript.start = Math.min(transcript.start, cds.start)
      transcript.end = Math.max(transcript.end, cds.end)
      transcript.subfeatures.push(cds)
      entry.aliases.push(...aliases)
    }
  }
  const lookup = new Map<string, CodingTranscript>()
  for (const { transcript, aliases } of byTranscript.values()) {
    for (const key of proteinKeys([transcript.id, ...aliases])) {
      lookup.set(key, transcript)
    }
  }
  return { lookup, transcripts: byTranscript.size }
}

export function findTranscript(
  lookup: Map<string, CodingTranscript>,
  protein: string,
) {
  for (const key of proteinKeys([protein])) {
    const hit = lookup.get(key)
    if (hit) {
      return hit
    }
  }
  return undefined
}

/**
 * One line of InterProScan's TSV, or of HMMER's `--domtblout` from either
 * hmmscan (query is the protein) or hmmsearch (target is the protein).
 * `isProtein` decides which side of a HMMER row names the protein.
 */
export function parseCall(
  line: string,
  isProtein: (id: string) => boolean,
): ProteinCall | undefined {
  if (line.startsWith('#') || line.trim() === '') {
    return undefined
  }
  const tabs = line.split('\t')
  if (tabs.length >= 11) {
    const [protein, , , source, accession, description, start, end, evalue] =
      tabs
    return {
      protein: protein!,
      start: +start!,
      end: +end!,
      accession: accession!,
      name: description && description !== '-' ? description : accession!,
      description: tabs[12] && tabs[12] !== '-' ? tabs[12] : description!,
      source: source!,
      evalue: evalue!,
    }
  }
  const cols = line.trim().split(/\s+/)
  if (cols.length < 23) {
    return undefined
  }
  const hmmIsTarget = isProtein(cols[3]!) || !isProtein(cols[0]!)
  const [name, accession, protein] = hmmIsTarget
    ? [cols[0]!, cols[1]!, cols[3]!]
    : [cols[3]!, cols[4]!, cols[0]!]
  return {
    protein,
    start: +cols[19]!,
    end: +cols[20]!,
    accession,
    name,
    description: cols.slice(22).join(' '),
    source: 'HMMER',
    evalue: cols[12]!,
  }
}

/**
 * HMMER reports every family that clears its threshold, so related families
 * (SH3_1, SH3_2, SH3_9) stack on one stretch of protein. Where two hits on a
 * protein share more than half the shorter one, the lower E-value wins, as
 * pfam_scan and InterProScan resolve them. Calls from InterProScan pass
 * through, already resolved.
 */
export function bestOfOverlappingHmmerHits(calls: ProteinCall[]) {
  const kept: ProteinCall[] = []
  const byProtein = new Map<string, ProteinCall[]>()
  for (const call of calls) {
    if (call.source === 'HMMER') {
      const list = byProtein.get(call.protein) ?? []
      list.push(call)
      byProtein.set(call.protein, list)
    } else {
      kept.push(call)
    }
  }
  for (const hits of byProtein.values()) {
    const accepted: ProteinCall[] = []
    for (const hit of hits.sort((a, b) => +a.evalue - +b.evalue)) {
      const clashes = accepted.some(a => {
        const shared =
          Math.min(a.end, hit.end) - Math.max(a.start, hit.start) + 1
        const shorter = Math.min(a.end - a.start, hit.end - hit.start) + 1
        return shared * 2 > shorter
      })
      if (!clashes) {
        accepted.push(hit)
      }
    }
    kept.push(...accepted)
  }
  return kept
}

/**
 * The genome blocks under residues `startAa..endAa` (1-based, inclusive, as
 * domain callers report them), in genome order.
 */
export function projectResidues(
  transcript: CodingTranscript,
  startAa: number,
  endAa: number,
) {
  return proteinRangeToGenome(transcript, startAa - 1, endAa).map(
    ([start, end]) => ({ start, end }),
  )
}

export const BED_HEADER = [
  'chrom',
  'chromStart',
  'chromEnd',
  'name',
  'score',
  'strand',
  'thickStart',
  'thickEnd',
  'itemRgb',
  'blockCount',
  'blockSizes',
  'chromStarts',
  'accession',
  'description',
  'source',
  'transcript',
  'proteinStart',
  'proteinEnd',
  'evalue',
]

/** BED's 0..1000 score as ten times -log10(E), so 1e-50 scores 500 */
export function evalueScore(evalue: string) {
  const score = Math.round(-10 * Math.log10(Number(evalue)))
  return Number.isNaN(score) ? 0 : Math.min(1000, Math.max(0, score))
}

const tsvField = (s: string) => s.replaceAll(/[\t\n\r]/g, ' ')

export function bedLine(
  transcript: CodingTranscript,
  call: ProteinCall,
  blocks: { start: number; end: number }[],
) {
  const start = blocks[0]!.start
  const end = blocks.at(-1)!.end
  return [
    transcript.refName,
    start,
    end,
    tsvField(call.name),
    evalueScore(call.evalue),
    transcript.strand === 1 ? '+' : '-',
    start,
    end,
    0,
    blocks.length,
    blocks.map(b => b.end - b.start).join(','),
    blocks.map(b => b.start - start).join(','),
    tsvField(call.accession),
    tsvField(call.description),
    tsvField(call.source),
    transcript.id,
    call.start,
    call.end,
    call.evalue,
  ].join('\t')
}
