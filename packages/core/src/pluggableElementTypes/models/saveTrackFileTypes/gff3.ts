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
  return str.replaceAll(/[%;=&,\t\n\r]/g, c => gff3Escapes[c]!)
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

// GFF3 requires a phase (0|1|2) on CDS features. When a non-GFF3 source omits
// it, derive it from the cumulative CDS length in translation order (sort
// ascending on +, descending on -), assuming the 5'-most CDS begins in frame.
// https://github.com/The-Sequence-Ontology/Specifications/blob/master/gff3.md
function computeCdsPhases(subfeatures: Feature[], strand?: number) {
  const cds = subfeatures
    .filter(f => f.get('type') === 'CDS')
    .sort((a, b) =>
      strand === -1
        ? b.get('start') - a.get('start')
        : a.get('start') - b.get('start'),
    )
  const phases = new Map<Feature, number>()
  let cumulative = 0
  for (const f of cds) {
    phases.set(f, (3 - (cumulative % 3)) % 3)
    cumulative += f.get('end') - f.get('start')
  }
  return phases
}

function formatFeat({
  feature,
  id,
  parentId,
  refName,
  cdsPhase,
}: {
  feature: Feature
  id?: string
  parentId?: string
  refName?: string
  cdsPhase?: number
}) {
  const strand = feature.get('strand')
  const score = feature.get('score')
  const phase = feature.get('phase') ?? cdsPhase
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
  cdsPhase,
}: {
  feature: Feature
  parentId?: string
  parentRef?: string
  cdsPhase?: number
}): string {
  const refName = parentRef ?? feature.get('refName')
  const subfeatures = feature.get('subfeatures')

  // non-GFF3 sources (e.g. BigBed aggregated genes) synthesize parents with no
  // id attribute; manufacture one from the uniqueId so children can Parent= it
  const id =
    feature.get('id') ?? (subfeatures?.length ? feature.id() : undefined)

  // fill in CDS phase when missing; feature.get('phase') still wins per-feature
  const childPhases = subfeatures?.some(
    f => f.get('type') === 'CDS' && f.get('phase') === undefined,
  )
    ? computeCdsPhases(subfeatures, feature.get('strand'))
    : undefined

  return [
    formatFeat({ feature, id, parentId, refName, cdsPhase }),
    ...(subfeatures?.map(sub =>
      formatMultiLevelFeat({
        feature: sub,
        parentId: id,
        parentRef: refName,
        cdsPhase: childPhases?.get(sub),
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
