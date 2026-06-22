import { fetchSeq } from '../../../util/fetchSeq.ts'
import { max, min } from '../../../util/index.ts'

import type { AbstractSessionModel, Feature } from '../../../util/index.ts'

const coreFields = new Set([
  'uniqueId',
  'id',
  'name',
  'refName',
  'source',
  'type',
  'start',
  'end',
  'strand',
  'parent',
  'parentId',
  'score',
  'subfeatures',
  'phase',
])

// GenBank fixed-column layout: feature keys occupy cols 6-20, locations and
// qualifiers start at col 22. See https://www.insdc.org/submitting-standards/feature-table/
const TYPE_COLUMN_WIDTH = 15
const QUALIFIER_INDENT = ' '.repeat(21)
const DATE = '10-JAN-1970'

function fmt(obj: unknown): string | undefined {
  if (obj === null || obj === undefined) {
    return undefined
  }
  if (Array.isArray(obj)) {
    const items = obj.map(o => fmt(o)).filter(o => o !== undefined)
    return items.length > 0 ? items.join(',') : undefined
  }
  if (typeof obj === 'object') {
    return JSON.stringify(obj)
  }
  return `${obj}`
}

// Free-text qualifiers are wrapped in double quotes; literal quotes inside the
// value are escaped by doubling them, per the GenBank spec.
function qualifier(key: string, value: string) {
  return `${QUALIFIER_INDENT}/${key}="${value.replace(/"/g, '""')}"`
}

function loc(f: Feature, minPos: number) {
  const start = f.get('start') - minPos + 1
  const end = f.get('end') - minPos
  return `${start}..${end}`
}

// Build a (possibly spliced) location expression for a set of segments,
// e.g. join(1..100,201..300) or complement(join(...)) for the minus strand.
function joinLoc(feats: Feature[], strand: number, minPos: number) {
  const locs = feats
    .toSorted((a, b) => a.get('start') - b.get('start'))
    .map(f => loc(f, minPos))
  const expr = locs.length === 1 ? locs.join(',') : `join(${locs.join(',')})`
  return strand === -1 ? `complement(${expr})` : expr
}

function featureLine(type: string, location: string) {
  return `     ${type.slice(0, TYPE_COLUMN_WIDTH).padEnd(TYPE_COLUMN_WIDTH)} ${location}`
}

function formatTags({ feature, gene }: { feature: Feature; gene?: string }) {
  const tags: string[] = []
  // /gene ties gene/mRNA/CDS together; /label is what SnapGene/Geneious/ApE
  // display as the feature name on the map
  if (gene) {
    tags.push(qualifier('gene', gene))
  }
  const label = feature.get('name') ?? feature.get('id')
  if (label) {
    tags.push(qualifier('label', label))
  }
  for (const key of Object.keys(feature.toJSON())) {
    if (!coreFields.has(key)) {
      const value = fmt(feature.get(key))
      if (value) {
        tags.push(qualifier(key, value))
      }
    }
  }
  return tags
}

function formatCDS({
  feats,
  gene,
  strand,
  minPos,
}: {
  feats: Feature[]
  gene?: string
  strand: number
  minPos: number
}) {
  if (feats.length === 0) {
    return []
  }
  return [
    featureLine('CDS', joinLoc(feats, strand, minPos)),
    ...(gene ? [qualifier('gene', gene), qualifier('label', gene)] : []),
    `${QUALIFIER_INDENT}/codon_start=1`,
  ]
}

export function formatFeatWithSubfeatures({
  feature,
  minPos,
  geneName,
}: {
  feature: Feature
  minPos: number
  geneName?: string
}): string {
  const subfeatures = feature.get('subfeatures') ?? []
  const strand = feature.get('strand') ?? 0
  const type = `${feature.get('type')}`
  const exons = subfeatures.filter(f => f.get('type') === 'exon')

  // A top-level feature with children establishes the gene-group name, which is
  // threaded down so every part of the gene shares one /gene qualifier.
  const ownName = feature.get('name') ?? feature.get('id')
  const gene =
    geneName ?? (subfeatures.length > 0 && ownName ? ownName : undefined)

  // A spliced transcript is rendered as join() of its exons rather than a
  // single span, so external tools see the correct intron/exon structure.
  const segments = exons.length > 0 ? exons : [feature]
  const location = joinLoc(segments, strand, minPos)

  const primary = [featureLine(type, location), ...formatTags({ feature, gene })]

  const cds = subfeatures.filter(f => f.get('type') === 'CDS')
  const sansCDS = subfeatures.filter(
    f => f.get('type') !== 'CDS' && f.get('type') !== 'exon',
  )
  const cdsLines =
    cds.length > 0 ? formatCDS({ feats: cds, gene, strand, minPos }) : []
  return [
    ...primary,
    ...cdsLines,
    ...sansCDS.flatMap(sub =>
      formatFeatWithSubfeatures({ feature: sub, minPos, geneName: gene }),
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

// LOCUS line column layout per the GenBank flat-file spec: name at col 13,
// length right-justified ending at col 40, molecule/topology/division/date in
// their fixed slots.
function formatLocus(name: string, length: number) {
  return [
    'LOCUS'.padEnd(12),
    name.padEnd(16),
    ' ',
    String(length).padStart(11),
    ' bp ',
    '   ',
    'DNA'.padEnd(6),
    ' ',
    'linear'.padEnd(9),
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
}: {
  refName: string
  region: string
  assemblyName: string
  length: number
}) {
  return [
    formatLocus(region.replace(/[^\w.]/g, '_'), length),
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

export async function stringifyGBK({
  features,
  assemblyName,
  session,
}: {
  assemblyName: string
  session: AbstractSessionModel
  features: Feature[]
}) {
  if (!features.length) {
    return ''
  }
  const minPos = min(features.map(f => f.get('start')))
  const maxPos = max(features.map(f => f.get('end')))
  const length = maxPos - minPos
  const refName = features[0]!.get('refName')
  const region = `${refName}:${minPos + 1}..${maxPos}`

  const contig = await fetchSeq({
    session,
    assemblyName,
    start: minPos,
    end: maxPos,
    refName,
  })

  const header = formatHeader({ refName, region, assemblyName, length })
  const body = features.map(feat =>
    formatFeatWithSubfeatures({ feature: feat, minPos }),
  )
  return `${[...header, ...body, ...formatOrigin(contig)].join('\n')}\n`
}
