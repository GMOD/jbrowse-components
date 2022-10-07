import React from 'react'
import { Feat, stitch } from './util'

// note that these are currently put into the style section instead of being
// defined in classes to aid copy and paste to an external document e.g. word
const proteinColor = 'rgb(220,160,220)'
const intronColor = undefined
const cdsColor = 'rgb(220,220,180)'
const updownstreamColor = 'rgba(250,200,200)'
const utrColor = 'rgb(200,240,240)'
const genomeColor = 'rgb(200,280,200)'

export function GeneCDS({ cds, sequence }: { cds: Feat[]; sequence: string }) {
  return <span style={{ background: cdsColor }}>{stitch(cds, sequence)}</span>
}

export function GeneProtein({
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

export function GenecDNA({
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
  const chunks = cds.length
    ? [...cds, ...utr].sort((a, b) => a.start - b.start)
    : exons
  return (
    <>
      {upstream ? (
        <span style={{ background: updownstreamColor }}>{upstream}</span>
      ) : null}

      {chunks
        .filter(f => f.start !== f.end)
        .map((chunk, index) => {
          const intron = sequence.slice(chunk.end, chunks[index + 1]?.start)
          return (
            <React.Fragment key={JSON.stringify(chunk)}>
              <span
                style={{
                  background: chunk.type === 'CDS' ? cdsColor : utrColor,
                }}
              >
                {sequence.slice(chunk.start, chunk.end)}
              </span>
              {includeIntrons && index < chunks.length - 1 ? (
                <span style={{ background: intronColor }}>
                  {collapseIntron && intron.length > intronBp * 2
                    ? `${intron.slice(0, intronBp)}...${intron.slice(
                        -intronBp,
                      )}`
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

export function Genomic({
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

      <span
        style={{
          background: genomeColor,
        }}
      >
        {sequence}
      </span>

      {downstream ? (
        <span style={{ background: updownstreamColor }}>{downstream}</span>
      ) : null}
    </>
  )
}
