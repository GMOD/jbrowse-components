import {
  AbstractSessionModel,
  Feature,
  max,
  min,
  Region,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'

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

const blank = '                     '

const retitle = {
  name: 'Name',
} as Record<string, string | undefined>

function fmt(obj: unknown): string {
  if (Array.isArray(obj)) {
    return obj.map(o => fmt(o)).join(',')
  } else if (typeof obj === 'object') {
    return JSON.stringify(obj)
  } else {
    return `${obj}`
  }
}

function formatTags(f: Feature, parentId?: string, parentType?: string) {
  return [
    parentId && parentType ? `${blank}/${parentType}="${parentId}"` : '',
    f.get('id') ? `${blank}/name=${f.get('id')}` : '',
    ...f
      .tags()
      .filter(tag => !coreFields.has(tag))
      .map(tag => [tag, fmt(f.get(tag))])
      .filter(tag => !!tag[1] && tag[0] !== parentType)
      .map(tag => `${blank}/${retitle[tag[0]] || tag[0]}="${tag[1]}"`),
  ].filter(f => !!f)
}

function rs(f: Feature, min: number) {
  return f.get('start') - min + 1
}
function re(f: Feature, min: number) {
  return f.get('end') - min
}
function loc(f: Feature, min: number) {
  return `${rs(f, min)}..${re(f, min)}`
}
function formatFeat(
  f: Feature,
  min: number,
  parentType?: string,
  parentId?: string,
) {
  const type = `${f.get('type')}`.slice(0, 16)
  const l = loc(f, min)
  const locstrand = f.get('strand') === -1 ? `complement(${l})` : l
  return [
    `     ${type.padEnd(16)}${locstrand}`,
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
  const cds = feats.map(f => loc(f, min))
  const pre = `join(${cds})`
  const str = strand === -1 ? `complement(${pre})` : pre
  return feats.length
    ? [`     ${'CDS'.padEnd(16)}${str}`, `${blank}/${parentType}="${parentId}"`]
    : []
}

export function formatFeatWithSubfeatures(
  feature: Feature,
  min: number,
  parentId?: string,
  parentType?: string,
): string {
  const primary = formatFeat(feature, min, parentId, parentType)
  const subfeatures = feature.get('subfeatures') || []
  const cds = subfeatures.filter(f => f.get('type') === 'CDS')
  const sansCDS = subfeatures.filter(
    f => f.get('type') !== 'CDS' && f.get('type') !== 'exon',
  )
  const newParentId = feature.get('id')
  const newParentType = feature.get('type')
  const newParentStrand = feature.get('strand')
  return [
    ...primary,
    ...formatCDS(cds, newParentId, newParentType, newParentStrand, min),
    ...sansCDS.flatMap(sub =>
      formatFeatWithSubfeatures(sub, min, newParentId, newParentType),
    ),
  ].join('\n')
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
  const today = new Date()
  const month = today.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const day = today.toLocaleString('en-US', { day: 'numeric' })
  const year = today.toLocaleString('en-US', { year: 'numeric' })
  const date = `${day}-${month}-${year}`

  const start = min(features.map(f => f.get('start')))
  const end = max(features.map(f => f.get('end')))
  const length = end - start
  const refName = features[0].get('refName')

  const l1 = [
    `${'LOCUS'.padEnd(12)}`,
    `${refName}:${start + 1}..${end}`.padEnd(20),
    ` ${`${length} bp`}`.padEnd(15),
    ` ${'DNA'.padEnd(10)}`,
    `${'linear'.padEnd(10)}`,
    `${'UNK ' + date}`,
  ].join('')
  const l2 = 'FEATURES             Location/Qualifiers'
  const seq = await fetchSequence({
    session,
    assemblyName,
    regions: [{ assemblyName, start, end, refName }],
  })
  const contig = seq.map(f => f.get('seq') || '').join('')
  const lines = features.map(feat => formatFeatWithSubfeatures(feat, start))
  const seqlines = ['ORIGIN', `\t1 ${contig}`, '//']
  return [l1, l2, ...lines, ...seqlines].join('\n')
}

async function fetchSequence({
  session,
  regions,
  signal,
  assemblyName,
}: {
  assemblyName: string
  session: AbstractSessionModel
  regions: Region[]
  signal?: AbortSignal
}) {
  const { rpcManager, assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    regions: regions.map(r => ({
      ...r,
      refName: assembly.getCanonicalRefName(r.refName),
    })),
    sessionId,
    signal,
  }) as Promise<Feature[]>
}
