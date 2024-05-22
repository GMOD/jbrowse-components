import React from 'react'
import { Feat, stitch } from '../../util'
import { proteinColor } from '../util'
import { SplitString, splitString } from './util'

export default function ProteinSequence({
  cds,
  sequence,
  codonTable,
}: {
  cds: Feat[]
  sequence: string
  codonTable: Record<string, string>
}) {
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }

  const width = 50
  const { segments } = splitString(protein, width, 0)
  return (
    <pre>
      <SplitString
        color={proteinColor}
        chunks={segments}
        size={width}
        start={0}
      />
    </pre>
  )
}
