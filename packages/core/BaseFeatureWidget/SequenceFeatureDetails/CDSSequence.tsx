import React from 'react'
import { cdsColor } from './util'
import { Feat, stitch } from '../util'

export default function CDSSequence({
  cds,
  sequence,
}: {
  cds: Feat[]
  sequence: string
}) {
  return <span style={{ background: cdsColor }}>{stitch(cds, sequence)}</span>
}
