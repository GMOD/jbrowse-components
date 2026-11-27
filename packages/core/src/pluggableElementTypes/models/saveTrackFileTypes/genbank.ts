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
const LINE_WIDTH = 79
const DATE = '10-JAN-1970'

// A space a reader rejoins as the one it was: not after a quote, which
// Biopython reads as the end of the value, not before a slash, which starts a
// qualifier, and not in a run of spaces, which loses one of them
const LONE_SPACE = /(?<=[^ "]) (?=[^ /])/g
const RUN_START = /(?<=[^ "]) (?= *[^ /])/g

function spaces(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].map(({ index }) => index)
}

// the last such space that fits, else the start of a run that fits, else the
// next of either, since a break inside a word would put a space there
function spaceBreak(text: string, width: number) {
  const lone = spaces(text, LONE_SPACE)
  const runs = spaces(text, RUN_START)
  return (
    lone.findLast(i => i <= width) ??
    runs.findLast(i => i <= width) ??
    lone.find(i => i > width) ??
    runs.find(i => i > width) ??
    -1
  )
}

// Where a line past `width` breaks: at a space in qualifier text; after the
// last comma in a location; and anywhere in a /translation, which is rejoined
// with none.
function breakAt(text: string, width: number, breakAfter: string) {
  return text.length <= width
    ? -1
    : breakAfter === ''
      ? width
      : breakAfter === ' '
        ? spaceBreak(text, width)
        : text.lastIndexOf(breakAfter, width - 1) + 1 || width
}

function wrapped(lead: string, text: string, breakAfter = ' ') {
  const width = LINE_WIDTH - lead.length
  const lines = []
  let rest = text
  let cut = breakAt(rest, width, breakAfter)
  while (cut > 0) {
    lines.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
    cut = breakAt(rest, width, breakAfter)
  }
  lines.push(rest)
  return lines
    .map((line, i) => `${i === 0 ? lead : ' '.repeat(lead.length)}${line}`)
    .join('\n')
}

function qualifierLine(text: string) {
  return wrapped(QUALIFIER_INDENT, text)
}

// Free-text qualifiers are wrapped in double quotes; literal quotes inside the
// value are escaped by doubling them, per the GenBank spec.
function qualifier(key: string, value: string) {
  return wrapped(
    QUALIFIER_INDENT,
    `/${key}="${value.replaceAll('"', '""')}"`,
    key === 'translation' ? '' : ' ',
  )
}

// `circularLength` is set on a circular record, whose span past the origin is
// written join(a..L,1..b); `genomeLength` on any record of a circular genome
interface RecordFrame {
  minPos: number
  circularLength?: number
  genomeLength?: number
}

// a 1-based genome position as one in the record, which on a circular genome
// may lie across the origin from it
function recordPosition(pos: number, { minPos, genomeLength }: RecordFrame) {
  const shifted = pos - minPos
  return genomeLength === undefined
    ? shifted
    : ((((shifted - 1) % genomeLength) + genomeLength) % genomeLength) + 1
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

function joined(locs: string[]) {
  return locs.length === 1 ? locs.join(',') : `join(${locs.join(',')})`
}

// A trans-spliced feature's segments are in transcription order, which need
// not follow the strand, and may be on both strands
function isTransSpliced(whole: Feature, feats: Feature[]) {
  return (
    whole.get('trans_splicing') !== undefined ||
    new Set(feats.map(f => f.get('strand') ?? 0)).size > 1
  )
}

// Build a (possibly spliced) location expression for a set of segments,
// e.g. join(1..100,201..300) or complement(join(...)) for the minus strand.
// A trans-spliced feature's are written in the order given, each minus one
// complemented on its own.
function joinLoc(
  feats: Feature[],
  strand: number,
  frame: RecordFrame,
  transSpliced: boolean,
) {
  const sameStrand = () =>
    joined(
      feats
        .toSorted((a, b) => a.get('start') - b.get('start'))
        .flatMap(f => spans(f, frame)),
    )
  return transSpliced
    ? joined(
        feats.map(f =>
          f.get('strand') === -1
            ? `complement(${joined(spans(f, frame))})`
            : joined(spans(f, frame)),
        ),
      )
    : strand === -1
      ? `complement(${sameStrand()})`
      : sameStrand()
}

function featureLine(type: string, location: string) {
  return wrapped(
    `     ${type.slice(0, TYPE_COLUMN_WIDTH).padEnd(TYPE_COLUMN_WIDTH)} `,
    location,
    ',',
  )
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

// INSDC writes these values unquoted
const NUMBER_QUALIFIERS = new Set([
  'codon_start',
  'transl_table',
  'estimated_length',
  'number',
])

// and these with no value at all; GenBank import reads one as `true`
const FLAG_QUALIFIERS = new Set([
  'environmental_sample',
  'focus',
  'germline',
  'macronuclear',
  'proviral',
  'pseudo',
  'rearranged',
  'ribosomal_slippage',
  'trans_splicing',
  'transgenic',
])

// INSDC's spelling of a qualifier GenBank import reads back lowercased, or
// NCBI's GFF3 names otherwise, which are its ASN.1 source subtypes
const QUALIFIER_SPELLING: Record<string, string> = {
  'bio-material': 'bio_material',
  'cell-line': 'cell_line',
  'cell-type': 'cell_type',
  'clone-lib': 'clone_lib',
  'collected-by': 'collected_by',
  'collection-date': 'collection_date',
  country: 'geo_loc_name',
  'culture-collection': 'culture_collection',
  dbxref: 'db_xref',
  'dev-stage': 'dev_stage',
  ec_number: 'EC_number',
  'environmental-sample': 'environmental_sample',
  'identified-by': 'identified_by',
  'isolation-source': 'isolation_source',
  'lab-host': 'lab_host',
  'lat-lon': 'lat_lon',
  'mating-type': 'mating_type',
  'metagenome-source': 'metagenome_source',
  'nat-host': 'host',
  pcr_conditions: 'PCR_conditions',
  pcr_primers: 'PCR_primers',
  'plasmid-name': 'plasmid',
  'pop-variant': 'pop_variant',
  'specimen-voucher': 'specimen_voucher',
  'sub-species': 'sub_species',
  substr: 'sub_strain',
  'tissue-lib': 'tissue_lib',
  'tissue-type': 'tissue_type',
  'type-material': 'type_material',
}

// INSDC writes these unquoted, with a location of the record's own bases
const LOCATED_QUALIFIERS = new Set(['transl_except', 'anticodon'])

function locatedLines(key: string, value: unknown, frame: RecordFrame) {
  return attributeValues(value).map(v =>
    qualifierLine(
      `/${key}=${v.replace(/(?<=pos:).*?(?=,aa:)/, location =>
        location.replaceAll(/\d+/g, n =>
          String(recordPosition(Number(n), frame)),
        ),
      )}`,
    ),
  )
}

function attributeValues(value: unknown) {
  return [value].flat().flatMap(v => formatAttributeValue(v) || [])
}

// a qualifier the file repeated, as Prokka repeats /inference, is written once
// per value rather than joined into one value with a comma that is in neither
function qualifierLines(attribute: string, value: unknown) {
  const key = QUALIFIER_SPELLING[attribute] ?? attribute
  return attributeValues(value).map(v =>
    FLAG_QUALIFIERS.has(key) && v === 'true'
      ? qualifierLine(`/${key}`)
      : NUMBER_QUALIFIERS.has(key) && /^\d+$/.test(v)
        ? qualifierLine(`/${key}=${v}`)
        : qualifier(key, v),
  )
}

function formatTags({
  feature,
  gene,
  key,
  label = feature.get('name') ?? feature.get('id'),
  codonStart,
  frame,
}: {
  feature: Feature
  gene?: string
  key?: string
  label?: string
  codonStart?: number
  frame: RecordFrame
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
    tags.push(qualifierLine(`/codon_start=${codonStart}`))
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
      tags.push(
        ...(LOCATED_QUALIFIERS.has(key)
          ? locatedLines(key, feature.get(key), frame)
          : qualifierLines(key, feature.get(key))),
      )
    }
  }
  return tags
}

// the phase of the 5'-most CDS segment, 1-based
function codonStart(feats: Feature[], strand: number, transSpliced: boolean) {
  const first = feats.reduce((a, b) =>
    transSpliced
      ? a
      : strand === -1
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
// for all of them unless the CDS is a feature of its own; a CDS's Name is often
// its protein accession, so the gene symbol labels a CDS the file gave no /label
function formatCDS({
  feats,
  whole,
  gene,
  strand,
  frame,
}: {
  feats: Feature[]
  whole: Feature
  gene?: string
  strand: number
  frame: RecordFrame
}) {
  const ownLabel = whole.get('label')
  const transSpliced = isTransSpliced(whole, feats)
  return [
    featureLine('CDS', joinLoc(feats, strand, frame, transSpliced)),
    ...formatTags({
      feature: whole,
      gene,
      key: 'CDS',
      label:
        (typeof ownLabel === 'string' ? ownLabel : undefined) ??
        gene ??
        whole.get('name') ??
        whole.get('id'),
      codonStart: codonStart(feats, strand, transSpliced),
      frame,
    }),
  ]
}

export function formatFeatWithSubfeatures({
  feature,
  minPos,
  circularLength,
  genomeLength,
  geneName,
}: {
  feature: Feature
  minPos: number
  circularLength?: number
  genomeLength?: number
  geneName?: string
}): string {
  const frame = { minPos, circularLength, genomeLength }
  const subfeatures = feature.get('subfeatures') ?? []
  const strand = feature.get('strand') ?? 0
  const type = feature.get('type')
  const key = insdcFeatureKey(`${type}`)
  const exons = subfeatures.filter(f => f.get('type') === 'exon')
  const pieces = subfeatures.filter(
    f => f.get('type') === type && !f.get('subfeatures')?.length,
  )

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

  // A spliced transcript is rendered as join() of its exons, and a feature
  // over several spans as join() of its pieces, rather than a single span, so
  // external tools see the correct structure.
  const segments =
    exons.length > 0 ? exons : pieces.length > 0 ? pieces : [feature]
  const location = joinLoc(
    segments,
    strand,
    frame,
    isTransSpliced(feature, segments),
  )

  const cds = subfeatures.filter(
    f => f.get('type') === 'CDS' && !f.get('subfeatures')?.length,
  )
  const sansCDS = subfeatures.filter(
    f => !cds.includes(f) && f.get('type') !== 'exon' && !pieces.includes(f),
  )
  const ownCDS = key === 'CDS' && cds.length > 0
  const primary = ownCDS
    ? []
    : [featureLine(key, location), ...formatTags({ feature, gene, key, frame })]
  const cdsLines =
    cds.length > 0
      ? formatCDS({
          feats: cds,
          whole: ownCDS ? feature : cds[0]!,
          gene,
          strand,
          frame,
        })
      : []
  return [
    ...primary,
    ...cdsLines,
    ...sansCDS.flatMap(sub =>
      formatFeatWithSubfeatures({
        feature: sub,
        minPos,
        circularLength,
        genomeLength,
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

// what GenBank import and NCBI's GFF3 mark a source feature with, which the
// record says in its LOCUS line, or as /organelle, or INSDC has no qualifier
// for
const SOURCE_MARKERS = new Set(['gbkey', 'is_circular', 'genome'])

// INSDC's /organelle for an NCBI genome value naming one; the rest, such as
// genomic, chromosome or plasmid, have no qualifier
const ORGANELLES = new Map([
  ['apicoplast', 'plastid:apicoplast'],
  ['chloroplast', 'plastid:chloroplast'],
  ['chromatophore', 'chromatophore'],
  ['chromoplast', 'plastid:chromoplast'],
  ['cyanelle', 'plastid:cyanelle'],
  ['hydrogenosome', 'hydrogenosome'],
  ['kinetoplast', 'mitochondrion:kinetoplast'],
  ['leucoplast', 'plastid:leucoplast'],
  ['mitochondrion', 'mitochondrion'],
  ['nitroplast', 'nitroplast'],
  ['nucleomorph', 'nucleomorph'],
  ['plasmid-in-mitochondrion', 'mitochondrion'],
  ['plasmid-in-plastid', 'plastid'],
  ['plastid', 'plastid'],
  ['proplastid', 'plastid:proplastid'],
])

// The source key's qualifiers in the Feature Table Definition 11.4, and those
// it retired from new entries that older records still carry, as NCBI's
// NC_000913.3 still writes /sub_strain; a new-submission validator flags those,
// and keeping them is what lets an older record round-trip
const SOURCE_QUALIFIERS = new Set([
  'altitude',
  'bio_material',
  'cell_line',
  'cell_type',
  'chromosome',
  'clone',
  'clone_lib',
  'collected_by',
  'collection_date',
  'cultivar',
  'culture_collection',
  'db_xref',
  'dev_stage',
  'ecotype',
  'environmental_sample',
  'focus',
  'geo_loc_name',
  'germline',
  'haplogroup',
  'haplotype',
  'host',
  'identified_by',
  'isolate',
  'isolation_source',
  'lab_host',
  'lat_lon',
  'macronuclear',
  'map',
  'mating_type',
  'metagenome_source',
  'mol_type',
  'note',
  'organelle',
  'organism',
  'PCR_primers',
  'plasmid',
  'pop_variant',
  'proviral',
  'rearranged',
  'segment',
  'serotype',
  'serovar',
  'sex',
  'specimen_voucher',
  'strain',
  'sub_clone',
  'sub_species',
  'sub_strain',
  'submitter_seqid',
  'tissue_lib',
  'tissue_type',
  'transgenic',
  'type_material',
  'variety',
])

// NCBI's flatfile puts these in parentheses on SOURCE, as NC_001802.1's GFF3
// gb-synonym=HIV-1 and NC_045512.2's gb-acronym=SARS-CoV-2. With both, the
// second becomes a /note, and import ignores SOURCE, so a synonym is lost on a
// round trip
const COMMON_NAMES = new Set(['gb-synonym', 'gb-acronym'])

function sourceKeys(source: Feature | undefined) {
  return source
    ? Object.keys(source.toJSON()).filter(
        key => !coreFields.has(key) && !SOURCE_MARKERS.has(key),
      )
    : []
}

// a source attribute INSDC has no qualifier for is kept as a /note naming it,
// since a key outside the vocabulary fails validation
function sourceAttributeLines(key: string, value: unknown) {
  return SOURCE_QUALIFIERS.has(QUALIFIER_SPELLING[key] ?? key)
    ? qualifierLines(key, value)
    : qualifierLines(
        'note',
        attributeValues(value).map(v => `${key}: ${v}`),
      )
}

// INSDC requires /organism and /mol_type on every source; a track with no
// source feature of its own, or one that leaves either out, gets the assembly
// name and genomic DNA
function sourceQualifiers(
  source: Feature | undefined,
  keys: string[],
  organism: string,
) {
  const organelle = keys.includes('organelle')
    ? undefined
    : ORGANELLES.get(formatAttributeValue(source?.get('genome')) ?? '')
  return [
    ...(keys.includes('organism') ? [] : [qualifier('organism', organism)]),
    ...(organelle ? [qualifier('organelle', organelle)] : []),
    ...(keys.includes('mol_type')
      ? []
      : [qualifier('mol_type', 'genomic DNA')]),
    ...keys.flatMap(key => sourceAttributeLines(key, source?.get(key))),
  ]
}

// Metadata header plus the whole-sequence `source` feature that every GenBank
// record carries: the data's own where it has one, so a plasmid keeps its
// /plasmid and the organism its /strain and /db_xref
function formatHeader({
  refName,
  region,
  assemblyName,
  source,
  length,
  circular,
}: {
  refName: string
  region: string
  assemblyName: string
  source?: Feature
  length: number
  circular: boolean
}) {
  const organism = formatAttributeValue(source?.get('organism')) ?? assemblyName
  const keys = sourceKeys(source)
  const commonKey = keys.find(key => COMMON_NAMES.has(key))
  const commonName = commonKey
    ? formatAttributeValue(source?.get(commonKey))
    : undefined
  return [
    formatLocus(refName, length, circular),
    wrapped('DEFINITION  ', `${region} from ${assemblyName}.`),
    `ACCESSION   ${refName}`,
    `VERSION     ${refName}`,
    'KEYWORDS    .',
    wrapped(
      'SOURCE      ',
      `${organism}${commonName ? ` (${commonName})` : ''}`,
    ),
    `  ORGANISM  ${organism}`,
    '            .',
    'FEATURES             Location/Qualifiers',
    featureLine('source', `1..${length}`),
    ...sourceQualifiers(
      source,
      keys.filter(key => key !== commonKey),
      organism,
    ),
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
    (arcs.some(arc => arc.end > circularLength) ||
      [...arcs, ...regions].some(
        arc => arc.start <= 0 && arc.end >= circularLength,
      ))
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
  source,
  session,
  signal,
  statusCallback,
}: {
  refName: string
  features: Feature[]
  regions: Arc[]
  circularLength?: number
  assemblyName: string
  source?: Feature
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
    source,
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
      genomeLength: circularLength,
    }),
  )
  return [...header, ...body, ...formatOrigin(contig.join(''))].join('\n')
}

export async function stringifyGBK({
  features,
  circularLengths,
  sourceRecords,
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
  sourceRecords: Map<string, Feature>
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
        source: sourceRecords.get(refName),
        session,
        signal,
        statusCallback: slot(),
      }),
    ),
  )
  return records.join('\n')
}
