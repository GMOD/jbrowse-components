import React from 'react'
import { Feat, stitch } from '../util'
import { proteinColor } from './util'

export default function ProteinSequence({
  cds,
  sequence,
  codonTable,
}: {
  cds: Feat[]
  sequence: string
  codonTable: { [key: string]: string }
}) {
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }

  return <span style={{ background: proteinColor }}>{protein}</span>
}
