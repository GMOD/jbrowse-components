import type { Feature } from '@jbrowse/core/util'

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
  '_lineHash',
])

const retitle = {
  name: 'Name',
  alias: 'Alias',
  target: 'Target',
  gap: 'Gap',
  derives_from: 'Derives_from',
  note: 'Note',
  description: 'Note',
  dbxref: 'Dbxref',
  ontology_term: 'Ontology_term',
  is_circular: 'Is_circular',
} as Record<string, string>

function encodeGFF3Value(str: string): string {
  return str
    .replace(/%/g, '%25')
    .replace(/;/g, '%3B')
    .replace(/=/g, '%3D')
    .replace(/&/g, '%26')
    .replace(/,/g, '%2C')
    .replace(/\t/g, '%09')
    .replace(/\n/g, '%0A')
    .replace(/\r/g, '%0D')
}

function fmt(obj: unknown): string | undefined {
  if (obj === null || obj === undefined) {
    return undefined
  }
  if (Array.isArray(obj)) {
    const items = obj.map(o => fmt(o)).filter(o => o !== undefined)
    return items.length > 0 ? items.join(',') : undefined
  }
  if (typeof obj === 'object') {
    return encodeGFF3Value(JSON.stringify(obj))
  }
  return encodeGFF3Value(String(obj))
}

function formatAttributes(f: Feature, parentId?: string) {
  const attributes: string[] = []

  const id = f.get('id')
  if (id) {
    attributes.push(`ID=${encodeGFF3Value(String(id))}`)
  }

  if (parentId) {
    attributes.push(`Parent=${encodeGFF3Value(String(parentId))}`)
  }

  const tags = Object.keys(f.toJSON()).filter(tag => !coreFields.has(tag))
  const hasDescription = tags.includes('description')
  const hasNote = tags.includes('note')

  for (const tag of tags) {
    const val = f.get(tag)
    const formattedVal = fmt(val)
    if (formattedVal) {
      let key = retitle[tag] || tag
      if (tag === 'note' && hasDescription && hasNote) {
        key = 'note2'
      }
      attributes.push(`${key}=${formattedVal}`)
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
  return `${[
    '##gff-version 3',
    ...features.map(f => formatMultiLevelFeat(f)),
  ].join('\n')}\n`
}
