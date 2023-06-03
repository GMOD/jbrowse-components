import React from 'react'
import { genomeColor, updownstreamColor } from './util'

export default function GenomicSequence({
  sequence,
  upstream,
  downstream,
}: {
  sequence: string
  upstream?: string
  downstream?: string
}) {
  return (
    <>
      {upstream ? (
        <span style={{ background: updownstreamColor }}>{upstream}</span>
      ) : null}

      <span style={{ background: genomeColor }}>{sequence}</span>

      {downstream ? (
        <span style={{ background: updownstreamColor }}>{downstream}</span>
      ) : null}
    </>
  )
}
