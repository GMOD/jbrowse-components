import { IMPACT_TIERS } from './variantConsequence.ts'
import { PREDEFINED_SV_TYPES } from './variantSvType.ts'

import type { JexlFilterField } from '@jbrowse/core/ui/JexlFilterDialog'

type HeaderLine = Record<string, unknown>

interface Header {
  INFO?: Record<string, HeaderLine | undefined>
  FILTER?: Record<string, HeaderLine | undefined>
}

const COMPUTED = (
  [
    {
      label: 'maf',
      call: 'maf',
      type: 'number',
      description: 'Minor allele frequency over the called genotypes',
    },
    {
      label: 'missingness',
      call: 'missingness',
      type: 'number',
      description: 'Fraction of alleles that are no-calls',
    },
    {
      label: 'nAlt',
      call: 'nAlt',
      type: 'number',
      description: 'Number of ALT alleles',
    },
    {
      label: 'alleleLength',
      call: 'alleleLength',
      type: 'number',
      description: 'Longest allele in bp',
    },
    {
      label: 'svType',
      call: 'svType',
      type: 'text',
      values: PREDEFINED_SV_TYPES.map(t => t.type),
      description: 'Structural variant class',
    },
    {
      label: 'impact',
      call: 'impact',
      type: 'text',
      values: IMPACT_TIERS.map(t => t.tier),
      description: 'Most severe impact, from SnpEff ANN or VEP CSQ',
    },
    {
      label: 'consequences',
      call: 'consequences',
      type: 'text',
      multi: true,
      description: 'Every consequence term, from SnpEff ANN or VEP CSQ',
    },
  ] satisfies JexlFilterField[]
).map(field => ({ ...field, group: 'Computed' }))

function columns(filterIds: string[]) {
  return (
    [
      { label: 'QUAL', path: ['QUAL'], type: 'number' },
      {
        label: 'FILTER',
        path: ['FILTER'],
        type: 'text',
        multi: true,
        values: filterIds,
      },
      { label: 'ID', path: ['ID'], type: 'text', multi: true },
      { label: 'REF', path: ['REF'], type: 'text' },
      { label: 'ALT', path: ['ALT'], type: 'text', multi: true },
    ] satisfies JexlFilterField[]
  ).map(field => ({ ...field, group: 'Columns' }))
}

function infoField(id: string, line: HeaderLine): JexlFilterField {
  const { Type, Number: count, Description } = line
  return {
    label: id,
    path: ['INFO', id],
    group: 'INFO',
    type:
      Type === 'Flag'
        ? 'flag'
        : Type === 'Integer' || Type === 'Float'
          ? 'number'
          : 'text',
    multi: Type !== 'Flag' && count !== 1,
    description: typeof Description === 'string' ? Description : undefined,
  }
}

// @gmod/vcf merges the spec's reserved INFO fields into every header, so one
// equal to its reserved definition is taken as undeclared. A header copying the
// spec's line verbatim drops that field from the list; it can still be typed.
async function reservedInfo() {
  const { default: VCFParser } = await import('@gmod/vcf')
  return new VCFParser({
    header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  }).getMetadata('INFO') as Record<string, HeaderLine | undefined>
}

/**
 * The filter dialog's field picker for a VCF track: the fixed columns, the
 * INFO fields its header declares, and the variant functions.
 */
export async function variantFilterFields(
  metadata: Promise<unknown>,
): Promise<JexlFilterField[]> {
  try {
    const [header, reserved] = await Promise.all([
      metadata as Promise<Header | null>,
      reservedInfo(),
    ])
    const info = Object.entries(header?.INFO ?? {})
      .filter(
        (entry): entry is [string, HeaderLine] =>
          !!entry[1] &&
          JSON.stringify(entry[1]) !== JSON.stringify(reserved[entry[0]]),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, line]) => infoField(id, line))
    return [...columns(Object.keys(header?.FILTER ?? {})), ...info, ...COMPUTED]
  } catch (e) {
    console.error(e)
    return [...columns([]), ...COMPUTED]
  }
}
