/* eslint-disable react/prop-types */
import React, { useRef, useState, useEffect } from 'react'
import { Button, Select, MenuItem, Typography } from '@material-ui/core'
import { useInView } from 'react-intersection-observer'
import copy from 'copy-to-clipboard'
import {
  defaultCodonTable,
  generateCodonTable,
  revcom,
  getSession,
} from '../util'
import { BaseProps } from './types'
import { getConf } from '../configuration'
import { Feature, SimpleFeatureSerialized } from '../util/simpleFeature'

interface Feat {
  start: number
  end: number
  type: string
}
interface ParentFeat extends Feat {
  strand?: number
  subfeatures?: Feat[]
}

function stitch(subfeats: Feat[], sequence: string) {
  return subfeats.map(sub => sequence.slice(sub.start, sub.end)).join('')
}

// filter if they have the same ID
function filterId(feat: Feat) {
  return `${feat.start}-${feat.end}`
}

// filters if successive elements share same start/end
function dedupe(list: Feat[]) {
  return list.filter(
    (item, pos, ary) => !pos || filterId(item) !== filterId(ary[pos - 1]),
  )
}

function revlist(list: Feat[], seqlen: number) {
  return list
    .map(sub => ({
      ...sub,
      start: seqlen - sub.end,
      end: seqlen - sub.start,
    }))
    .sort((a, b) => a.start - b.start)
}

// note that these are currently put into the style section instead of being
// defined in classes to aid copy and paste to an external document e.g. word
const proteinColor = 'rgb(220,160,220)'
const intronColor = undefined
const cdsColor = 'rgb(220,220,180)'
const updownstreamColor = 'rgba(250,200,200)'
const utrColor = 'rgb(200,240,240)'

function GeneCDS(props: { cds: Feat[]; sequence: string }) {
  const { cds, sequence } = props

  return <span style={{ background: cdsColor }}>{stitch(cds, sequence)}</span>
}

function GeneProtein(props: {
  cds: Feat[]
  sequence: string
  codonTable: { [key: string]: string }
}) {
  const { cds, sequence, codonTable } = props
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }

  return <span style={{ background: proteinColor }}>{protein}</span>
}

function GenecDNA(props: {
  utr: Feat[]
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  includeIntrons?: boolean
  collapseIntron?: boolean
}) {
  const {
    utr,
    cds,
    exons,
    sequence,
    upstream,
    downstream,
    includeIntrons,
    collapseIntron,
  } = props
  const chunks = cds.length
    ? [...cds, ...utr].sort((a, b) => a.start - b.start)
    : exons
  return (
    <>
      {upstream ? (
        <span style={{ background: updownstreamColor }}>{upstream}</span>
      ) : null}

      {chunks.map((chunk, index) => {
        const intron = sequence.slice(chunk.end, chunks[index + 1]?.start)
        return (
          <React.Fragment key={JSON.stringify(chunk)}>
            <span
              style={{ background: chunk.type === 'CDS' ? cdsColor : utrColor }}
            >
              {sequence.slice(chunk.start, chunk.end)}
            </span>
            {includeIntrons ? (
              <span style={{ background: intronColor }}>
                {collapseIntron && intron.length > 20
                  ? `${intron.slice(0, 10)}...${intron.slice(-10)}`
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

// calculates UTRs using impliedUTRs logic
function calculateUTRs(cds: Feat[], exons: Feat[]) {
  const firstCds = cds[0]
  const lastCds = cds[cds.length - 1]
  const firstCdsIdx = exons.findIndex(
    exon => exon.end >= firstCds.start && exon.start <= firstCds.start,
  )
  const lastCdsIdx = exons.findIndex(
    exon => exon.end >= lastCds.end && exon.start <= lastCds.end,
  )
  const lastCdsExon = exons[lastCdsIdx]
  const firstCdsExon = exons[firstCdsIdx]

  const fiveUTRs = [
    ...exons.slice(0, firstCdsIdx),
    { start: firstCdsExon.start, end: firstCds.start },
  ].map(elt => ({ ...elt, type: 'five_prime_UTR' }))

  const threeUTRs = [
    { start: lastCds.end, end: lastCdsExon.end },
    ...exons.slice(lastCdsIdx),
  ].map(elt => ({ ...elt, type: 'three_prime_UTR' }))

  return [...fiveUTRs, ...threeUTRs]
}

export const SequencePanel = React.forwardRef<
  HTMLDivElement,
  {
    sequence: { seq: string; upstream: string; downstream: string }
    feature: ParentFeat
    mode: string
  }
>((props, ref) => {
  const { feature, mode } = props
  let {
    sequence: { seq: sequence, upstream = '', downstream = '' },
  } = props

  const { subfeatures } = feature
  const codonTable = generateCodonTable(defaultCodonTable)

  if (!subfeatures) {
    return null
  }

  const children = subfeatures
    .sort((a, b) => a.start - b.start)
    .map(sub => {
      return {
        ...sub,
        start: sub.start - feature.start,
        end: sub.end - feature.start,
      }
    })

  // we filter duplicate entries in cds and exon lists duplicate entries may be
  // rare but was seen in Gencode v36 track NCList, likely a bug on GFF3 or
  // probably worth ignoring here (produces broken protein translations if
  // included)
  //
  // position 1:224,800,006..225,203,064 gene ENSG00000185842.15 first
  // transcript ENST00000445597.6
  //
  // http://localhost:3000/?config=test_data%2Fconfig.json&session=share-FUl7G1isvF&password=HXh5Y

  let cds = dedupe(children.filter(sub => sub.type === 'CDS'))
  let utr = dedupe(children.filter(sub => sub.type.match(/utr/i)))
  let exons = dedupe(children.filter(sub => sub.type === 'exon'))

  if (!utr.length && cds.length && exons.length) {
    utr = calculateUTRs(cds, exons)
  }

  if (feature.strand === -1) {
    // doing this in a single assignment is needed because downstream and
    // upstream are swapped so this avoids a temp variable
    ;[sequence, upstream, downstream] = [
      revcom(sequence),
      revcom(downstream),
      revcom(upstream),
    ]
    cds = revlist(cds, sequence.length)
    exons = revlist(exons, sequence.length)
    utr = revlist(utr, sequence.length)
  }

  return (
    <div ref={ref} data-testid="sequence_panel">
      {mode === 'cds' ? (
        <GeneCDS cds={cds} sequence={sequence} />
      ) : mode === 'cdna' ? (
        <GenecDNA exons={exons} cds={cds} utr={utr} sequence={sequence} />
      ) : mode === 'protein' ? (
        <GeneProtein cds={cds} codonTable={codonTable} sequence={sequence} />
      ) : mode === 'gene' ? (
        <GenecDNA
          exons={exons}
          cds={cds}
          utr={utr}
          sequence={sequence}
          includeIntrons
        />
      ) : mode === 'gene_collapsed_intron' ? (
        <GenecDNA
          exons={exons}
          cds={cds}
          sequence={sequence}
          utr={utr}
          includeIntrons
          collapseIntron
        />
      ) : mode === 'gene_updownstream' ? (
        <GenecDNA
          exons={exons}
          cds={cds}
          sequence={sequence}
          utr={utr}
          upstream={upstream}
          downstream={downstream}
          includeIntrons
        />
      ) : mode === 'gene_updownstream_collapsed_intron' ? (
        <GenecDNA
          exons={exons}
          cds={cds}
          sequence={sequence}
          utr={utr}
          upstream={upstream}
          downstream={downstream}
          includeIntrons
          collapseIntron
        />
      ) : (
        <div>Unknown type</div>
      )}
    </div>
  )
})

// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
export default function SequenceFeatureDetails(props: BaseProps) {
  const { model, feature } = props
  const parentFeature = (feature as unknown) as ParentFeat
  const hasCDS = parentFeature.subfeatures?.find(sub => sub.type === 'CDS')
  const seqPanelRef = useRef<HTMLDivElement>(null)

  const { ref, inView } = useInView()
  const [sequence, setSequence] = useState<{
    seq: string
    upstream: string
    downstream: string
  }>()
  const [error, setError] = useState<string>()
  const [mode, setMode] = useState(hasCDS ? 'cds' : 'cdna')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let finished = false
    if (!model || !inView) {
      return () => {}
    }
    const { assemblyManager, rpcManager } = getSession(model)
    const [assemblyName] = model.view?.assemblyNames || []
    async function fetchSeq(start: number, end: number, refName: string) {
      const assembly = await assemblyManager.waitForAssembly(assemblyName)
      if (!assembly) {
        throw new Error('assembly not found')
      }
      const sessionId = 'getSequence'
      const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig: getConf(assembly, ['sequence', 'adapter']),
        sessionId,
        region: {
          start,
          end,
          refName: assembly.getCanonicalRefName(refName),
        },
      })

      const [feat] = feats as Feature[]
      if (!feat) {
        throw new Error(
          `sequence not found for feature with refName:${refName}`,
        )
      }
      return feat.get('seq') as string
    }
    ;(async () => {
      try {
        const {
          start: s,
          end: e,
          refName,
        } = feature as SimpleFeatureSerialized & {
          refName: string
          start: number
          end: number
        }
        const seq = await fetchSeq(s, e, refName)
        const upstream = await fetchSeq(Math.max(0, s - 500), s, refName)
        const downstream = await fetchSeq(e, e + 500, refName)
        if (!finished) {
          setSequence({ seq, upstream, downstream })
        }
      } catch (e) {
        setError(e)
      }
    })()

    return () => {
      finished = true
    }
  }, [feature, inView, model])

  const loading = !sequence

  return (
    <div ref={ref}>
      <Select
        value={mode}
        onChange={event => setMode(event.target.value as string)}
      >
        {hasCDS ? <MenuItem value="cds">CDS</MenuItem> : null}
        {hasCDS ? <MenuItem value="protein">Protein</MenuItem> : null}
        <MenuItem value="gene">Gene w/ introns</MenuItem>
        <MenuItem value="gene_collapsed_intron">
          Gene w/ 10bp of intron
        </MenuItem>
        <MenuItem value="gene_updownstream">
          Gene w/ 500bp up+down stream
        </MenuItem>
        <MenuItem value="gene_updownstream_collapsed_intron">
          Gene w/ 500bp up+down stream w/ 10bp intron
        </MenuItem>
        <MenuItem value="cdna">cDNA</MenuItem>
      </Select>
      <Button
        type="button"
        variant="contained"
        onClick={() => {
          if (seqPanelRef.current) {
            copy(seqPanelRef.current.innerHTML, { format: 'text/html' })
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 1000)
          }
        }}
      >
        {copied ? 'Copied to clipboard!' : 'Copy'}
      </Button>
      <div data-testid="feature_sequence">
        {error ? (
          <Typography color="error">{`${error}`}</Typography>
        ) : loading ? (
          <div>Loading gene sequence...</div>
        ) : sequence ? (
          <div style={{ fontFamily: 'monospace', wordWrap: 'break-word' }}>
            <SequencePanel
              ref={seqPanelRef}
              feature={parentFeature}
              mode={mode}
              sequence={sequence}
            />
          </div>
        ) : (
          <div>No sequence found</div>
        )}
      </div>
    </div>
  )
}
