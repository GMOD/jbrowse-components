import { Feature } from '@jbrowse/core/util'

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
  } else if (typeof obj === 'object') {
    return JSON.stringify(obj)
  } else {
    return `${obj}`
  }
}

function formatFeat(f: Feature, parentId?: string, parentRef?: string) {
  return [
    f.get('refName') || parentRef,
    f.get('source') || '.',
    f.get('type') || '.',
    f.get('start') + 1,
    f.get('end'),
    f.get('score') || '.',
    f.get('strand') === 1 ? '+' : f.get('strand') === -1 ? '-' : '.',
    f.get('phase') || '.',
    (parentId ? `Parent=${parentId};` : '') +
      f
        .tags()
        .filter(tag => !coreFields.has(tag))
        .map(tag => [tag, fmt(f.get(tag))])
        .filter(tag => !!tag[1])
        .map(tag => `${retitle[tag[0]] || tag[0]}=${tag[1]}`)
        .join(';'),
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
