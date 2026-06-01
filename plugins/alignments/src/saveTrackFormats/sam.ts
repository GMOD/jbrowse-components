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
    const nextPos = feature.get('next_pos') as number | undefined
    // TODO: optional tags not yet output
    lines.push(
      [
        feature.get('name') || feature.get('id') || '*',
        (feature.get('flag') as number | undefined) ?? 0,
        feature.get('refName') || '*',
        String(start + 1),
        (feature.get('mapq') as number | undefined) ?? 255,
        (feature.get('CIGAR') as string | undefined) || '*',
        (feature.get('next_ref') as string | undefined) || '*',
        typeof nextPos === 'number' ? String(nextPos + 1) : '0',
        (feature.get('template_len') as number | undefined) ?? 0,
        (feature.get('seq') as string | undefined) || '*',
        qualToPhred((feature.get('qual') as string | undefined) ?? ''),
      ].join('\t'),
    )
  }

  return lines.join('\n')
}
