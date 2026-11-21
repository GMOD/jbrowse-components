import { fetchSeq } from '../../../util/fetchSeq.ts'
import { createStatusFanOut, groupBy, max, min } from '../../../util/index.ts'
import { coreFeatureFields, formatAttributeValue } from './util.ts'

import type {
  AbstractSessionModel,
  Feature,
  Region,
  StatusCallback,
} from '../../../util/index.ts'

// name becomes the /label qualifier rather than one of its own
const coreFields = new Set([...coreFeatureFields, 'name'])

// GenBank fixed-column layout: feature keys occupy cols 6-20, locations and
// qualifiers start at col 22. See https://www.insdc.org/submitting-standards/feature-table/
const TYPE_COLUMN_WIDTH = 15
const QUALIFIER_INDENT = ' '.repeat(21)
const DATE = '10-JAN-1970'

// Free-text qualifiers are wrapped in double quotes; literal quotes inside the
// value are escaped by doubling them, per the GenBank spec.
function qualifier(key: string, value: string) {
  return `${QUALIFIER_INDENT}/${key}="${value.replaceAll('"', '""')}"`
}

// `circularLength` is set on a circular record, whose span past the origin is
// written join(a..L,1..b)
interface RecordFrame {
  minPos: number
  circularLength?: number
}

function spans(f: Feature, { minPos, circularLength }: RecordFrame) {
  const start = f.get('start') - minPos
  const end = f.get('end') - minPos
  return circularLength === undefined || end <= circularLength
    ? [`${start + 1}..${end}`]
    : start >= circularLength
      ? [`${start - circularLength + 1}..${end - circularLength}`]
      : [`${start + 1}..${circularLength}`, `1..${end - circularLength}`]
}

// Build a (possibly spliced) location expression for a set of segments,
// e.g. join(1..100,201..300) or complement(join(...)) for the minus strand.
function joinLoc(feats: Feature[], strand: number, frame: RecordFrame) {
  const locs = feats
    .toSorted((a, b) => a.get('start') - b.get('start'))
    .flatMap(f => spans(f, frame))
  const expr = locs.length === 1 ? locs.join(',') : `join(${locs.join(',')})`
  return strand === -1 ? `complement(${expr})` : expr
}

function featureLine(type: string, location: string) {
  return `     ${type.slice(0, TYPE_COLUMN_WIDTH).padEnd(TYPE_COLUMN_WIDTH)} ${location}`
}

/**
 * The feature key column holds one of a closed list, so a SO term JBrowse names
 * a feature with is not a key by virtue of being a type. A reader that does not
 * recognize the key falls back to drawing nothing in particular — which is what
 * a BLAT hit, a CRISPR guide, a restriction site and an hgPcr product all got,
 * and what `primer` got where SnapGene draws a primer only for `primer_bind`.
 *
 * https://www.insdc.org/submitting-standards/feature-table/
 */
const INSDC_KEYS = new Set([
  "3'UTR",
  "5'UTR",
  'assembly_gap',
  'C_region',
  'CDS',
  'centromere',
  'D-loop',
  'D_segment',
  'exon',
  'gap',
  'gene',
  'iDNA',
  'intron',
  'J_segment',
  'mat_peptide',
  'misc_binding',
  'misc_difference',
  'misc_feature',
  'misc_recomb',
  'misc_RNA',
  'misc_structure',
  'mobile_element',
  'modified_base',
  'mRNA',
  'N_region',
  'ncRNA',
  'old_sequence',
  'operon',
  'oriT',
  'polyA_site',
  'precursor_RNA',
  'prim_transcript',
  'primer_bind',
  'propeptide',
  'protein_bind',
  'regulatory',
  'rep_origin',
  'repeat_region',
  'rRNA',
  'S_region',
  'sig_peptide',
  'source',
  'stem_loop',
  'STS',
  'telomere',
  'tmRNA',
  'transit_peptide',
  'tRNA',
  'unsure',
  'V_region',
  'V_segment',
  'variation',
])

// SO terms this tree emits that the feature table spells differently. Anything
// absent from both this and INSDC_KEYS is a real feature with no key of its own
// — a guide, a PAM, a restriction site, a BLAT hit, an hgPcr product — and
// becomes misc_feature, which is what the key exists for.
const SO_TO_INSDC: Record<string, string> = {
  five_prime_UTR: "5'UTR",
  three_prime_UTR: "3'UTR",
  primer: 'primer_bind',
  primer_binding_site: 'primer_bind',
  transcript: 'mRNA',
  pseudogene: 'gene',
  promoter: 'regulatory',
  enhancer: 'regulatory',
  terminator: 'regulatory',
  polyA_site: 'polyA_site',
  origin_of_replication: 'rep_origin',
  repeat_unit: 'repeat_region',
  SNV: 'variation',
  SNP: 'variation',
}

// The keys whose group shares one /gene symbol. A feature with children is not
// a gene by having them: threading the symbol off any parent labelled an hgPcr
// product `/gene="100 bp"` and a BLAT hit `/gene="YourSeq 99.1%"`, which reads
// downstream as a gene of that name.
const GENE_GROUP_KEYS = new Set([
  'gene',
  'mRNA',
  'ncRNA',
  'rRNA',
  'tRNA',
  'tmRNA',
  'misc_RNA',
  'precursor_RNA',
  'prim_transcript',
  'CDS',
  'exon',
])

export function insdcFeatureKey(type: string) {
  const mapped = SO_TO_INSDC[type] ?? type
  return INSDC_KEYS.has(mapped) ? mapped : 'misc_feature'
}

function formatTags({
  feature,
  gene,
  key,
  label = feature.get('name') ?? feature.get('id'),
  codonStart,
}: {
  feature: Feature
  gene?: string
  key?: string
  label?: string
  codonStart?: number
}) {
  const tags: string[] = []
  const written = new Set<string>()
  // /gene ties gene/mRNA/CDS together; /label is what SnapGene/Geneious/ApE
  // display as the feature name on the map
  if (gene) {
    tags.push(qualifier('gene', gene))
    written.add('gene')
  }
  if (label) {
    tags.push(qualifier('label', label))
    written.add('label')
  }
  if (codonStart !== undefined) {
    tags.push(`${QUALIFIER_INDENT}/codon_start=${codonStart}`)
    written.add('codon_start')
  }
  // a feature that had to become misc_feature still knows what it is, so the
  // term it came in as rides along rather than being dropped at the key column
  const type = `${feature.get('type')}`
  if (key === 'misc_feature' && type && type !== 'misc_feature') {
    tags.push(qualifier('note', type))
  }
  for (const key of Object.keys(feature.toJSON())) {
    if (!coreFields.has(key) && !written.has(key)) {
      const value = formatAttributeValue(feature.get(key))
      if (value) {
        tags.push(qualifier(key, value))
      }
    }
  }
  return tags
}

// the phase of the 5'-most CDS segment, 1-based
function codonStart(feats: Feature[], strand: number) {
  const first = feats.reduce((a, b) =>
    strand === -1
      ? b.get('end') > a.get('end')
        ? b
        : a
      : b.get('start') < a.get('start')
        ? b
        : a,
  )
  return (first.get('phase') ?? 0) + 1
}

// every piece of a CDS carries the whole CDS's qualifiers, so the first speaks
// for all of them; a piece's id names a row, not the protein, so the gene
// labels a CDS that has no name of its own
function formatCDS({
  feats,
  gene,
  strand,
  frame,
}: {
  feats: Feature[]
  gene?: string
  strand: number
  frame: RecordFrame
}) {
  const piece = feats[0]!
  return [
    featureLine('CDS', joinLoc(feats, strand, frame)),
    ...formatTags({
      feature: piece,
      gene,
      key: 'CDS',
      label: piece.get('name') ?? gene ?? piece.get('id'),
      codonStart: codonStart(feats, strand),
    }),
  ]
}

export function formatFeatWithSubfeatures({
  feature,
  minPos,
  circularLength,
  geneName,
}: {
  feature: Feature
  minPos: number
  circularLength?: number
  geneName?: string
}): string {
  const frame = { minPos, circularLength }
  const subfeatures = feature.get('subfeatures') ?? []
  const strand = feature.get('strand') ?? 0
  const key = insdcFeatureKey(`${feature.get('type')}`)
  const exons = subfeatures.filter(f => f.get('type') === 'exon')

  // A gene-group feature with children establishes the symbol, which is threaded
  // down so every part of the gene shares one /gene qualifier. GenBank import
  // names a feature by its /label first, so its own /gene comes first here.
  const ownName =
    formatAttributeValue(feature.get('gene')) ??
    feature.get('name') ??
    feature.get('id')
  const gene =
    geneName ??
    (GENE_GROUP_KEYS.has(key) && subfeatures.length > 0 && ownName
      ? ownName
      : undefined)

  // A spliced transcript is rendered as join() of its exons rather than a
  // single span, so external tools see the correct intron/exon structure.
  const segments = exons.length > 0 ? exons : [feature]
  const location = joinLoc(segments, strand, frame)

  const primary = [
    featureLine(key, location),
    ...formatTags({ feature, gene, key }),
  ]

  const cds = subfeatures.filter(f => f.get('type') === 'CDS')
  const sansCDS = subfeatures.filter(
    f => f.get('type') !== 'CDS' && f.get('type') !== 'exon',
  )
  const cdsLines =
    cds.length > 0 ? formatCDS({ feats: cds, gene, strand, frame }) : []
  return [
    ...primary,
    ...cdsLines,
    ...sansCDS.flatMap(sub =>
      formatFeatWithSubfeatures({
        feature: sub,
        minPos,
        circularLength,
        geneName: gene,
      }),
    ),
  ].join('\n')
}

function formatOrigin(sequence: string): string[] {
  const lines = ['ORIGIN']
  for (let i = 0; i < sequence.length; i += 60) {
    const pos = String(i + 1).padStart(9)
    const chunk = sequence.slice(i, i + 60).toLowerCase()
    const groups = chunk.match(/.{1,10}/g) ?? []
    lines.push(`${pos} ${groups.join(' ')}`)
  }
  lines.push('//')
  return lines
}

// LOCUS line column layout per the GenBank flat-file spec. A positional parser
// reads each field out of a fixed slot, so the widths below ARE the format:
//
//   1-5 LOCUS · 6-12 spaces · 13-28 name · 29 space · 30-40 length ·
//   41-44 " bp " · 45-47 strandedness · 48-54 molecule · 55 space ·
//   56-63 topology · 64 space · 65-67 division · 68 space · 69-79 date
//
// Molecule runs to 54 and topology starts at 56, which is one column right of
// where it reads: every real NCBI record spells `DNA` then five spaces then
// `circular`. Writing topology from 55 put a letter in the space at 55 and
// Biopython refused all nine snapshot records, while the snapshot tests stayed
// green because they pin the bytes rather than the format. `locusColumns` in
// the test file is the check that names which slot moved.
//
// The name is the 16-column locus field, so it is the refName rather than the
// region: `chr17:7,668,402..7,687,550` sanitizes to 22 characters and pushed
// every field after it 6 columns right. The coordinates are on DEFINITION,
// where the line is free text.
const LOCUS_NAME_WIDTH = 16

function formatLocus(refName: string, length: number, circular: boolean) {
  const name = refName.replaceAll(/[^\w.]/g, '_').slice(0, LOCUS_NAME_WIDTH)
  return [
    'LOCUS'.padEnd(12),
    name.padEnd(LOCUS_NAME_WIDTH),
    ' ',
    String(length).padStart(11),
    ' bp ',
    '   ',
    'DNA'.padEnd(7),
    ' ',
    (circular ? 'circular' : 'linear').padEnd(8),
    ' ',
    'UNK'.padEnd(3),
    ' ',
    DATE,
  ].join('')
}

// Metadata header plus the whole-sequence `source` feature that every GenBank
// record carries.
function formatHeader({
  refName,
  region,
  assemblyName,
  length,
  circular,
}: {
  refName: string
  region: string
  assemblyName: string
  length: number
  circular: boolean
}) {
  return [
    formatLocus(refName, length, circular),
    `DEFINITION  ${region} from ${assemblyName}.`,
    `ACCESSION   ${refName}`,
    `VERSION     ${refName}`,
    'KEYWORDS    .',
    `SOURCE      ${assemblyName}`,
    `  ORGANISM  ${assemblyName}`,
    '            .',
    'FEATURES             Location/Qualifiers',
    featureLine('source', `1..${length}`),
    qualifier('organism', assemblyName),
    `${QUALIFIER_INDENT}/mol_type="genomic DNA"`,
    qualifier('chromosome', refName),
  ]
}

interface Arc {
  start: number
  end: number
}

// from the end of the widest gap between `arcs` round to its start, or the
// whole circular sequence when they leave none
function spanAcrossOrigin(arcs: Arc[], length: number) {
  const firstStart = min(arcs.map(arc => arc.start))
  let reach = firstStart
  let widest = { gap: 0, start: 0, end: length, circular: true }
  for (const arc of arcs.toSorted((a, b) => a.start - b.start)) {
    if (arc.start - reach > widest.gap) {
      widest = {
        gap: arc.start - reach,
        start: arc.start,
        end: reach + length,
        circular: false,
      }
    }
    reach = Math.max(reach, arc.end)
  }
  return firstStart + length - reach > widest.gap
    ? { start: firstStart, end: reach, circular: false }
    : widest
}

function recordSpan({
  features,
  regions,
  circularLength,
}: {
  features: Feature[]
  regions: Arc[]
  circularLength?: number
}) {
  const arcs = features.map(f => ({ start: f.get('start'), end: f.get('end') }))
  return circularLength !== undefined &&
    arcs.some(arc => arc.end > circularLength)
    ? spanAcrossOrigin([...arcs, ...regions], circularLength)
    : {
        start: min(arcs.map(arc => arc.start)),
        end: max(arcs.map(arc => arc.end)),
        circular: false,
      }
}

// One LOCUS..ORIGIN..// record, spanning the features on a single reference
// sequence. GenBank has no way to express a span that crosses one, which is why
// this takes a refName rather than deriving it.
async function formatRecord({
  refName,
  features,
  regions,
  circularLength,
  assemblyName,
  session,
  signal,
  statusCallback,
}: {
  refName: string
  features: Feature[]
  regions: Arc[]
  circularLength?: number
  assemblyName: string
  session: AbstractSessionModel
  signal?: AbortSignal
  statusCallback?: StatusCallback
}) {
  const span = recordSpan({ features, regions, circularLength })
  const stretches =
    circularLength !== undefined && !span.circular && span.end > circularLength
      ? [
          { start: span.start, end: circularLength },
          { start: 0, end: span.end - circularLength },
        ]
      : [span]
  const region = `${refName}:${stretches.map(({ start, end }) => `${start + 1}..${end}`).join(',')}`

  const contig = await Promise.all(
    stretches.map(({ start, end }) =>
      fetchSeq({
        session,
        assemblyName,
        start,
        end,
        refName,
        signal,
        statusCallback,
      }),
    ),
  )

  const header = formatHeader({
    refName,
    region,
    assemblyName,
    length: span.end - span.start,
    circular: span.circular,
  })
  const body = features.map(feature =>
    formatFeatWithSubfeatures({
      feature,
      minPos:
        circularLength !== undefined && feature.get('start') < span.start
          ? span.start - circularLength
          : span.start,
      circularLength: span.circular ? circularLength : undefined,
    }),
  )
  return [...header, ...body, ...formatOrigin(contig.join(''))].join('\n')
}

export async function stringifyGBK({
  features,
  circularLengths,
  regions,
  assemblyName,
  session,
  signal,
  statusCallback,
}: {
  assemblyName: string
  session: AbstractSessionModel
  features: Feature[]
  circularLengths: Map<string, number>
  regions: Region[]
  signal?: AbortSignal
  statusCallback?: StatusCallback
}) {
  // A record per reference sequence, which is what GenBank is: a multi-region
  // view used to take min(start)/max(end) across every feature and label the
  // result with the first one's refName, so two contigs on screen produced one
  // record spanning a stretch of sequence that does not exist, with an ORIGIN
  // fetched over it.
  const byRefName = groupBy(features, f => f.get('refName'))
  // the records fetch their ORIGIN concurrently and all report the same phase,
  // so each gets its own fan-out slot rather than the caller's raw callback —
  // otherwise the first contig to finish blanks the label for the rest
  const slot = createStatusFanOut(statusCallback)
  const assembly = session.assemblyManager.get(assemblyName)
  const canonical = (refName: string) =>
    assembly?.getCanonicalRefName2(refName) ?? refName
  const records = await Promise.all(
    Object.entries(byRefName).map(([refName, feats]) =>
      formatRecord({
        refName,
        features: feats,
        regions: regions.filter(
          region => canonical(region.refName) === canonical(refName),
        ),
        circularLength: circularLengths.get(refName),
        assemblyName,
        session,
        signal,
        statusCallback: slot(),
      }),
    ),
  )
  return records.join('\n')
}
