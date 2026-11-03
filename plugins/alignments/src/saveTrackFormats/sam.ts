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

const SAM_TAG = /^[A-Za-z][A-Za-z0-9]$/

function numberType(values: number[]) {
  return values.every(v => Number.isInteger(v)) ? 'i' : 'f'
}

function arraySubtype(values: number[]) {
  return values.every(v => Number.isInteger(v) && v >= 0 && v <= 255)
    ? 'C'
    : numberType(values)
}

// A serialized read keeps a tag's value but not its type, so the type is the
// one the value implies: text is Z (an A tag comes back as Z, since a one-letter
// Z such as RG:Z:1 must stay Z), a whole number i, any other number f, and an
// array B over the same two, or C when every element is a byte, since htslib
// reads an ML tag only as B:C. A value of no SAM type is left out.
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v: unknown) => isFiniteNumber(v))
  )
}

function samTag(key: string, value: unknown) {
  return !SAM_TAG.test(key)
    ? undefined
    : typeof value === 'string'
      ? `${key}:Z:${value.replaceAll(/[\t\r\n]/g, ' ')}`
      : isFiniteNumber(value)
        ? `${key}:${numberType([value])}:${value}`
        : isNumberArray(value)
          ? `${key}:B:${arraySubtype(value)},${value.join(',')}`
          : undefined
}

function samTags(feature: Feature) {
  const tags = feature.get('tags') as Record<string, unknown> | undefined
  return Object.entries(tags ?? {}).flatMap(([key, value]) => {
    const tag = samTag(key, value)
    return tag === undefined ? [] : [tag]
  })
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
        ...samTags(feature),
      ].join('\t'),
    )
  }

  return `${lines.join('\n')}\n`
}
