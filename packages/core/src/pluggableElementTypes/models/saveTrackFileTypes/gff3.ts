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

const retitle: Record<string, string> = {
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
}

const gff3Escapes: Record<string, string> = {
  '%': '%25',
  ';': '%3B',
  '=': '%3D',
  '&': '%26',
  ',': '%2C',
  '\t': '%09',
  '\n': '%0A',
  '\r': '%0D',
}

function encodeGFF3Value(str: string): string {
  return str.replace(/[%;=&,\t\n\r]/g, c => gff3Escapes[c]!)
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

function formatAttributes(
  f: Feature,
  { id, parentId }: { id?: string; parentId?: string },
) {
  const attributes: string[] = []

  if (id) {
    attributes.push(`ID=${encodeGFF3Value(id)}`)
  }
  if (parentId) {
    attributes.push(`Parent=${encodeGFF3Value(parentId)}`)
  }

  const tags = Object.keys(f.toJSON()).filter(tag => !coreFields.has(tag))
  const hasDescription = tags.includes('description')

  for (const tag of tags) {
    const val = f.get(tag)
    const formattedVal = fmt(val)
    if (formattedVal) {
      // both note and description map to Note; keep note as note2 so the
      // description-derived Note isn't clobbered
      const key =
        tag === 'note' && hasDescription ? 'note2' : retitle[tag] || tag
      attributes.push(`${key}=${formattedVal}`)
    }
  }
  return attributes.join(';')
}

function formatFeat({
  feature,
  id,
  parentId,
  refName,
}: {
  feature: Feature
  id?: string
  parentId?: string
  refName?: string
}) {
  const strand = feature.get('strand')
  const score = feature.get('score')
  const phase = feature.get('phase')
  return [
    refName,
    feature.get('source') || '.',
    feature.get('type') || '.',
    feature.get('start') + 1,
    feature.get('end'),
    score ?? '.',
    strand === 1 ? '+' : strand === -1 ? '-' : '.',
    phase ?? '.',
    formatAttributes(feature, { id, parentId }),
  ].join('\t')
}

export function formatMultiLevelFeat({
  feature,
  parentId,
  parentRef,
}: {
  feature: Feature
  parentId?: string
  parentRef?: string
}): string {
  const refName = parentRef ?? feature.get('refName')
  const subfeatures = feature.get('subfeatures')

  // non-GFF3 sources (e.g. BigBed aggregated genes) synthesize parents with no
  // id attribute; manufacture one from the uniqueId so children can Parent= it
  const id =
    feature.get('id') ?? (subfeatures?.length ? feature.id() : undefined)

  return [
    formatFeat({ feature, id, parentId, refName }),
    ...(subfeatures?.map(sub =>
      formatMultiLevelFeat({
        feature: sub,
        parentId: id,
        parentRef: refName,
      }),
    ) ?? []),
  ].join('\n')
}

export function stringifyGFF3({ features }: { features: Feature[] }) {
  return `${[
    '##gff-version 3',
    ...features.map(f => formatMultiLevelFeat({ feature: f })),
  ].join('\n')}\n`
}
