import type { AssemblyHost, Feature } from '@jbrowse/core/util'

function qualToPhred(qual: string | undefined): string {
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
  session: AssemblyHost
  assemblyName: string
}) {
  const lines: string[] = ['@HD\tVN:1.6\tSO:unsorted']

  const assembly = session.assemblyManager.get(assemblyName)
  if (assembly?.regions) {
    for (const region of assembly.regions) {
      // a whole-sequence region is 0-based, so `end` is the sequence length;
      // `end - start` under-reported LN for any region not starting at 0
      lines.push(`@SQ\tSN:${region.refName}\tLN:${region.end}`)
    }
  }

  lines.push('@PG\tID:jbrowse\tPN:JBrowse\tVN:2')

  // The features arrive in the file's own contig names and the @SQ lines above
  // use the assembly's, so RNAME and RNEXT are renamed to match them — a record
  // naming a reference the header doesn't list is invalid SAM.
  const canonical = (refName: string | undefined) =>
    refName && assembly ? assembly.getCanonicalRefName2(refName) : refName

  for (const feature of features) {
    const start = feature.get('start')
    const nextPos = feature.get('next_pos') as number | undefined
    // TODO: optional tags not yet output
    lines.push(
      [
        feature.get('name') || '*',
        (feature.get('flags') as number | undefined) ?? 0,
        canonical(feature.get('refName')) || '*',
        String(start + 1),
        feature.get('score') ?? 255,
        (feature.get('CIGAR') as string | undefined) || '*',
        canonical(feature.get('next_ref') as string | undefined) || '*',
        typeof nextPos === 'number' ? String(nextPos + 1) : '0',
        (feature.get('template_length') as number | undefined) ?? 0,
        (feature.get('seq') as string | undefined) || '*',
        qualToPhred(feature.get('qual') as string | undefined),
      ].join('\t'),
    )
  }

  return `${lines.join('\n')}\n`
}
