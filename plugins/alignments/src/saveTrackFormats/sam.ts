import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

function qualToPhred(qual: string): string {
  if (!qual) {
    return '*'
  }
  return qual
    .split(' ')
    .map(q => String.fromCharCode(+q + 33))
    .join('')
}

export function stringifySAM({
  features,
  session,
  assemblyName,
}: {
  features: Feature[]
  session: AbstractSessionModel
  assemblyName: string
}) {
  const lines: string[] = ['@HD\tVN:1.6\tSO:unsorted']

  const assembly = session.assemblyManager.get(assemblyName)
  if (assembly?.regions) {
    for (const region of assembly.regions) {
      lines.push(`@SQ\tSN:${region.refName}\tLN:${region.end - region.start}`)
    }
  }

  lines.push('@PG\tID:jbrowse\tPN:JBrowse\tVN:2')

  for (const feature of features) {
    const start = feature.get('start')
    const nextPos = feature.get('next_pos')
    // TODO: optional tags not yet output
    lines.push(
      [
        feature.get('name') || feature.get('id') || '*',
        feature.get('flag') ?? '0',
        feature.get('refName') || '*',
        String(start + 1),
        feature.get('mapq') ?? '255',
        feature.get('CIGAR') || '*',
        feature.get('next_ref') || '*',
        typeof nextPos === 'number' ? String(nextPos + 1) : '0',
        feature.get('template_len') ?? '0',
        feature.get('seq') || '*',
        qualToPhred(feature.get('qual')),
      ].join('\t'),
    )
  }

  return lines.join('\n')
}
