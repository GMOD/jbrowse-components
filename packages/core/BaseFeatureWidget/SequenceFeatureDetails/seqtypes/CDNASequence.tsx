import React from 'react'
import { Feat } from '../util'
import { cdsColor, intronColor, updownstreamColor, utrColor } from './util'

export default function CDNASequence({
  utr,
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  includeIntrons,
  collapseIntron,
  intronBp,
}: {
  utr: Feat[]
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  includeIntrons?: boolean
  collapseIntron?: boolean
  intronBp: number
}) {
  const chunks = (
    cds.length ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  return (
    <>
      {upstream ? (
        <span style={{ background: updownstreamColor }}>{upstream}</span>
      ) : null}

      {chunks.map((chunk, idx) => {
        const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)

        return (
          <React.Fragment key={JSON.stringify(chunk)}>
            <span
              style={{
                background: chunk.type === 'CDS' ? cdsColor : utrColor,
              }}
            >
              {sequence.slice(chunk.start, chunk.end)}
            </span>
            {includeIntrons && idx < chunks.length - 1 ? (
              <span style={{ background: intronColor }}>
                {collapseIntron && intron.length > intronBp * 2
                  ? `${intron.slice(0, intronBp)}...${intron.slice(-intronBp)}`
                  : intron}
              </span>
            ) : null}
          </React.Fragment>
        )
      })}

      {downstream ? (
        <span style={{ background: updownstreamColor }}>{downstream}</span>
      ) : null}
    </>
  )
}
