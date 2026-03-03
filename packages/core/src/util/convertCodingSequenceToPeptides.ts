import { stitch } from '../BaseFeatureWidget/util.tsx'

import type { Feat } from '../BaseFeatureWidget/util.tsx'

export function convertCodingSequenceToPeptides({
  cds,
  sequence,
  codonTable,
}: {
  cds: Feat[]
  sequence: string
  codonTable: Record<string, string>
}) {
  const phase = cds[0]?.phase ?? 0
  const str = stitch(cds, sequence)
  let protein = phase > 0 ? '&' : ''
  for (let i = phase; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }
  return protein
}
