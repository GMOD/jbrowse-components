import { fetchSequence } from './fetchSequence.ts'
import { max, min } from '../../../util/index.ts'

import type { AbstractSessionModel, Feature } from '../../../util/index.ts'

const coreFields = new Set([
  'uniqueId',
  'id',
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

const TYPE_COLUMN_WIDTH = 16
const QUALIFIER_INDENT = ' '.repeat(21)

const retitle = {
  name: 'Name',
} as Record<string, string | undefined>

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

function loc(f: Feature, minPos: number) {
  const start = f.get('start') - minPos + 1
  const end = f.get('end') - minPos
  return `${start}..${end}`
}

function formatTags({
  feature,
  parentId,
  parentType,
}: {
  feature: Feature
  parentId?: string
  parentType?: string
}) {
  const tags: string[] = []
  if (parentId && parentType) {
    tags.push(`${QUALIFIER_INDENT}/${parentType}="${parentId}"`)
  }
  const id = feature.get('id')
  if (id) {
    tags.push(`${QUALIFIER_INDENT}/name="${id}"`)
  }
  for (const key of Object.keys(feature.toJSON())) {
    if (!coreFields.has(key) && key !== parentType) {
      const value = fmt(feature.get(key))
      if (value) {
        tags.push(`${QUALIFIER_INDENT}/${retitle[key] ?? key}="${value}"`)
      }
    }
  }
  return tags
}

function formatFeat({
  feature,
  minPos,
  parentId,
  parentType,
}: {
  feature: Feature
  minPos: number
  parentId?: string
  parentType?: string
}) {
  const type = `${feature.get('type')}`.slice(0, TYPE_COLUMN_WIDTH)
  const l = loc(feature, minPos)
  const locstrand = feature.get('strand') === -1 ? `complement(${l})` : l
  return [
    `     ${type.padEnd(TYPE_COLUMN_WIDTH)}${locstrand}`,
    ...formatTags({ feature, parentId, parentType }),
  ]
}

function formatCDS({
  feats,
  parentId,
  parentType,
  strand,
  minPos,
}: {
  feats: Feature[]
  parentId: string
  parentType: string
  strand: number
  minPos: number
}) {
  if (feats.length === 0) {
    return []
  }
  const locs = feats.map(f => loc(f, minPos))
  const locExpr = locs.length === 1 ? locs[0] : `join(${locs.join(',')})`
  const strandExpr = strand === -1 ? `complement(${locExpr})` : locExpr
  return [
    `     ${'CDS'.padEnd(TYPE_COLUMN_WIDTH)}${strandExpr}`,
    `${QUALIFIER_INDENT}/${parentType}="${parentId}"`,
  ]
}

export function formatFeatWithSubfeatures({
  feature,
  minPos,
  parentId,
  parentType,
}: {
  feature: Feature
  minPos: number
  parentId?: string
  parentType?: string
}): string {
  const primary = formatFeat({ feature, minPos, parentId, parentType })
  const subfeatures = feature.get('subfeatures') ?? []
  const cds = subfeatures
    .filter(f => f.get('type') === 'CDS')
    .sort((a, b) => a.get('start') - b.get('start'))
  const sansCDS = subfeatures.filter(
    f => f.get('type') !== 'CDS' && f.get('type') !== 'exon',
  )
  const newParentId = feature.get('id')
  const newParentType = feature.get('type')
  const newParentStrand = feature.get('strand') ?? 0
  const cdsLines =
    cds.length > 0 && newParentId && newParentType
      ? formatCDS({
          feats: cds,
          parentId: newParentId,
          parentType: newParentType,
          strand: newParentStrand,
          minPos,
        })
      : []
  return [
    ...primary,
    ...cdsLines,
    ...sansCDS.flatMap(sub =>
      formatFeatWithSubfeatures({
        feature: sub,
        minPos,
        parentId: newParentId,
        parentType: newParentType,
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
  const date = '10-JAN-1970'
  const minPos = min(features.map(f => f.get('start')))
  const maxPos = max(features.map(f => f.get('end')))
  const length = maxPos - minPos
  const refName = features[0]!.get('refName') || ''

  const l1 = [
    'LOCUS'.padEnd(12),
    `${refName}:${minPos + 1}..${maxPos}`.padEnd(20),
    ` ${length} bp`.padEnd(15),
    ` ${'DNA'.padEnd(10)}`,
    'linear'.padEnd(10),
    `UNK ${date}`,
  ].join('')
  const l2 = 'FEATURES             Location/Qualifiers'
  const contig =
    (await fetchSequence({
      session,
      region: { assemblyName, start: minPos, end: maxPos, refName },
    })) ?? ''
  const lines = features.map(feat =>
    formatFeatWithSubfeatures({ feature: feat, minPos }),
  )
  return `${[l1, l2, ...lines, ...formatOrigin(contig)].join('\n')}\n`
}
