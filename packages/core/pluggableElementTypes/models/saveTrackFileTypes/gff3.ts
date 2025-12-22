import type { Feature } from '@jbrowse/core/util'

const coreFields = new Set([
  'uniqueId',
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

const retitle = {
  id: 'ID',
  name: 'Name',
  alias: 'Alias',
  parent: 'Parent',
  target: 'Target',
  gap: 'Gap',
  derives_from: 'Derives_from',
  note: 'Note',
  description: 'Note',
  dbxref: 'Dbxref',
  ontology_term: 'Ontology_term',
  is_circular: 'Is_circular',
} as Record<string, string>

function fmt(obj: unknown): string {
  if (Array.isArray(obj)) {
    return obj.map(o => fmt(o)).join(',')
  } else if (typeof obj === 'object' && obj !== null) {
    return JSON.stringify(obj)
  } else {
    return String(obj)
  }
}

function formatAttributes(f: Feature, parentId?: string) {
  const attributes = []
  if (parentId) {
    attributes.push(`Parent=${parentId}`)
  }

  const tags = Object.keys(f.toJSON()).filter(tag => !coreFields.has(tag))

  for (const tag of tags) {
    const val = f.get(tag)
    if (val !== undefined && val !== null) {
      const formattedVal = fmt(val)
      if (formattedVal) {
        const key = retitle[tag] || tag
        attributes.push(`${key}=${formattedVal}`)
      }
    }
  }
  return attributes.join(';')
}

function formatFeat(f: Feature, parentId?: string, parentRef?: string) {
  const strand = f.get('strand')
  const score = f.get('score')
  const phase = f.get('phase')
  return [
    f.get('refName') || parentRef,
    f.get('source') || '.',
    f.get('type') || '.',
    f.get('start') + 1,
    f.get('end'),
    score !== undefined && score !== null ? score : '.',
    strand === 1 ? '+' : strand === -1 ? '-' : '.',
    phase !== undefined && phase !== null ? phase : '.',
    formatAttributes(f, parentId),
  ].join('\t')
}
export function formatMultiLevelFeat(
  feature: Feature,
  parentId?: string,
  parentRef?: string,
): string {
  const featureRefName = parentRef || feature.get('refName')
  const featureId = feature.get('id')
  const primary = formatFeat(feature, parentId, featureRefName)

  return [
    primary,
    ...(feature
      .get('subfeatures')
      ?.map(sub => formatMultiLevelFeat(sub, featureId, featureRefName)) || []),
  ].join('\n')
}

export function stringifyGFF3({ features }: { features: Feature[] }) {
  return [
    '##gff-version 3',
    ...features.map(f => formatMultiLevelFeat(f)),
  ].join('\n')
}
