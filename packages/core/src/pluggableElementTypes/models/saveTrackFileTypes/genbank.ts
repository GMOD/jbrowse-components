/**
 * EXPERIMENTAL: GenBank format exporter
 *
 * This module provides experimental support for exporting features to GenBank format.
 * The generated output may not fully conform to the GenBank specification and should
 * be validated before use in production workflows.
 */
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

const blank = '                     '

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

function formatTags(f: Feature, parentId?: string, parentType?: string) {
  const tags: string[] = []
  if (parentId && parentType) {
    tags.push(`${blank}/${parentType}="${parentId}"`)
  }
  const id = f.get('id')
  if (id) {
    tags.push(`${blank}/name="${id}"`)
  }
  for (const key of Object.keys(f.toJSON())) {
    if (!coreFields.has(key) && key !== parentType) {
      const value = fmt(f.get(key))
      if (value) {
        tags.push(`${blank}/${retitle[key] || key}="${value}"`)
      }
    }
  }
  return tags
}

function relativeStart(f: Feature, min: number) {
  return f.get('start') - min + 1
}
function relativeEnd(f: Feature, min: number) {
  return f.get('end') - min
}
function loc(f: Feature, min: number) {
  return `${relativeStart(f, min)}..${relativeEnd(f, min)}`
}
function formatFeat(
  f: Feature,
  min: number,
  parentType?: string,
  parentId?: string,
) {
  const type = `${f.get('type')}`.slice(0, TYPE_COLUMN_WIDTH)
  const l = loc(f, min)
  const locstrand = f.get('strand') === -1 ? `complement(${l})` : l
  return [
    `     ${type.padEnd(TYPE_COLUMN_WIDTH)}${locstrand}`,
    ...formatTags(f, parentType, parentId),
  ]
}

function formatCDS(
  feats: Feature[],
  parentId: string,
  parentType: string,
  strand: number,
  min: number,
) {
  if (feats.length === 0) {
    return []
  }
  const locs = feats.map(f => loc(f, min))
  const locExpr = locs.length === 1 ? locs[0] : `join(${locs.join(',')})`
  const strandExpr = strand === -1 ? `complement(${locExpr})` : locExpr
  return [
    `     ${'CDS'.padEnd(TYPE_COLUMN_WIDTH)}${strandExpr}`,
    `${blank}/${parentType}="${parentId}"`,
  ]
}

export function formatFeatWithSubfeatures(
  feature: Feature,
  min: number,
  parentId?: string,
  parentType?: string,
): string {
  const primary = formatFeat(feature, min, parentId, parentType)
  const subfeatures = feature.get('subfeatures') || []
  const cds = subfeatures
    .filter(f => f.get('type') === 'CDS')
    .sort((a, b) => a.get('start') - b.get('start'))
  const sansCDS = subfeatures.filter(
    f => f.get('type') !== 'CDS' && f.get('type') !== 'exon',
  )
  const newParentId = feature.get('id')
  const newParentType = feature.get('type')
  const newParentStrand = feature.get('strand')
  const cdsLines =
    cds.length > 0 && newParentId && newParentType
      ? formatCDS(cds, newParentId, newParentType, newParentStrand, min)
      : []
  return [
    ...primary,
    ...cdsLines,
    ...sansCDS.flatMap(sub =>
      formatFeatWithSubfeatures(sub, min, newParentId, newParentType),
    ),
  ].join('\n')
}

function formatOrigin(sequence: string): string[] {
  const lines = ['ORIGIN']
  for (let i = 0; i < sequence.length; i += 60) {
    const pos = String(i + 1).padStart(9)
    const chunk = sequence.slice(i, i + 60).toLowerCase()
    const groups = chunk.match(/.{1,10}/g) || []
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

  const start = min(features.map(f => f.get('start')))
  const end = max(features.map(f => f.get('end')))
  const length = end - start
  const refName = features[0]!.get('refName') || ''

  const l1 = [
    'LOCUS'.padEnd(12),
    `${refName}:${start + 1}..${end}`.padEnd(20),
    ` ${length} bp`.padEnd(15),
    ` ${'DNA'.padEnd(10)}`,
    'linear'.padEnd(10),
    `UNK ${date}`,
  ].join('')
  const l2 = 'FEATURES             Location/Qualifiers'
  const contig =
    (await fetchSequence({
      session,
      region: { assemblyName, start, end, refName },
    })) ?? ''
  const lines = features.map(feat => formatFeatWithSubfeatures(feat, start))
  return `${[l1, l2, ...lines, ...formatOrigin(contig)].join('\n')}\n`
}
