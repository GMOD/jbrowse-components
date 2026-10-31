import { IMPACT_TIERS } from '../../shared/variantConsequence.ts'

export interface ConsequenceFormat {
  title: string
  headerRegex: RegExp
  headline: string[]
  impact: string
}

export const consequenceFormats = {
  CSQ: {
    title: 'Variant CSQ field',
    headerRegex: /Format:\s*(.*)/,
    headline: ['Consequence', 'IMPACT', 'SYMBOL', 'Feature'],
    impact: 'IMPACT',
  },
  ANN: {
    title: 'Variant ANN field',
    headerRegex: /Functional annotations:\s*'(.*)'/,
    headline: ['Annotation', 'Annotation_Impact', 'Gene_Name', 'Feature_ID'],
    impact: 'Annotation_Impact',
  },
} satisfies Record<string, ConsequenceFormat>

const impactRank = new Map<string, number>(
  IMPACT_TIERS.map(({ tier }, rank) => [tier, rank]),
)
const impactColor = new Map<string, string>(
  IMPACT_TIERS.map(({ tier, color }) => [tier, color]),
)

// SnpEff/VEP write the header field list with padding ("'Allele | Annotation
// | ...'") while the per-variant data uses bare pipes
export function headerFields(description: string, format: ConsequenceFormat) {
  return (
    description
      .match(format.headerRegex)?.[1]
      ?.split('|')
      .map(f => f.trim()) ?? []
  )
}

export function parseConsequences(
  data: string[],
  allFields: string[],
  format: ConsequenceFormat,
) {
  const rank = (record: Record<string, string>) =>
    impactRank.get(record[format.impact] ?? '') ?? impactRank.size
  const parsed = data.map(entry => entry.split('|'))
  const fields = allFields.filter((_, i) => parsed.some(parts => parts[i]))
  const records = parsed
    .map(parts =>
      Object.fromEntries(
        allFields
          .map((field, i) => [field, parts[i] ?? ''] as const)
          .filter(([, value]) => value),
      ),
    )
    .sort((a, b) => rank(a) - rank(b))
  const multipleAlleles = new Set(records.map(record => record.Allele)).size > 1
  const headlineFields = multipleAlleles
    ? ['Allele', ...format.headline]
    : format.headline
  return {
    fields,
    records: records.map((record, idx) => {
      const headline = headlineFields
        .map(field => record[field])
        .filter(Boolean)
        .join(' · ')
      return {
        record,
        headline: headline ? headline : `Annotation ${idx + 1}`,
        color: impactColor.get(record[format.impact] ?? ''),
      }
    }),
  }
}
