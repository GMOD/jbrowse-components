import React from 'react'
import { cdsColor } from '../util'
import { Feat, stitch } from '../../util'
import { SplitString, splitString } from './util'

export default function CDSSequence({
  cds,
  sequence,
}: {
  cds: Feat[]
  sequence: string
}) {
  const width = 50
  const { segments } = splitString(stitch(cds, sequence), width, 0)
  return (
    <pre>
      <SplitString color={cdsColor} chunks={segments} size={width} start={0} />
    </pre>
  )
}
