import type {
  CandidateId,
  CandidateVariant,
  DecisionRecord,
} from '../candidates/types.ts'

export const DECISION_TSV_COLUMNS = [
  'candidate_id',
  'assembly',
  'ref_name',
  'pos',
  'ref',
  'alt',
  'vcf_id',
  'filter',
  'qual',
  'decision',
  'note',
  'timestamp',
] as const

// a tab or newline inside a free-text field would shift every later column
function cell(value: unknown) {
  return value === undefined || value === null
    ? ''
    : String(value).replaceAll(/[\t\r\n]+/g, ' ')
}

/**
 * The review as a table: every candidate in list order with `pos` the 1-based
 * VCF POS, unreviewed rows included (a table missing them cannot be diffed
 * against the call set), then every decision whose candidate is not in the
 * list — filtered out, or the file changed — with only its id and decision,
 * since dropping it would lose work silently.
 */
export function decisionsTsv(
  candidates: readonly CandidateVariant[],
  decisions: ReadonlyMap<CandidateId, DecisionRecord>,
) {
  const lines = [DECISION_TSV_COLUMNS.join('\t')]
  const listed = new Set<CandidateId>()
  for (const c of candidates) {
    listed.add(c.id)
    const d = decisions.get(c.id)
    lines.push(
      [
        c.id,
        c.assemblyName,
        c.refName,
        c.pos1,
        c.ref,
        c.alt.join(','),
        c.vcfId,
        c.filter?.join(';'),
        c.qual,
        d?.decision ?? 'unreviewed',
        d?.note,
        d?.timestamp,
      ]
        .map(cell)
        .join('\t'),
    )
  }
  for (const [id, d] of decisions) {
    if (!listed.has(id)) {
      const row: unknown[] = DECISION_TSV_COLUMNS.map(() => undefined)
      row[0] = id
      row[DECISION_TSV_COLUMNS.indexOf('decision')] = d.decision
      lines.push(row.map(cell).join('\t'))
    }
  }
  return `${lines.join('\n')}\n`
}
