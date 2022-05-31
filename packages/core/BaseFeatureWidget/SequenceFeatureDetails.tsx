import React, { useRef, useState, useEffect } from 'react'
import {
  Button,
  IconButton,
  MenuItem,
  Select,
  Typography,
  Tooltip,
  makeStyles,
} from '@material-ui/core'
import SettingsDlg from './SequenceFeatureSettingsDialog'
import { useInView } from 'react-intersection-observer'
import copy from 'copy-to-clipboard'

// locals
import {
  defaultCodonTable,
  parseCodonTable,
  generateCodonTable,
  revcom,
  getSession,
} from '../util'
import { BaseProps } from './types'
import { getConf } from '../configuration'
import { Feature, SimpleFeatureSerialized } from '../util/simpleFeature'
import { useLocalStorage } from '../util'
import {
  Feat,
  ParentFeat,
  SeqState,
  calculateUTRs,
  stitch,
  dedupe,
  revlist,
} from './util'

// icons
import SettingsIcon from '@material-ui/icons/Settings'

interface CoordFeat extends SimpleFeatureSerialized {
  refName: string
  start: number
  end: number
}

const useStyles = makeStyles(theme => ({
  button: {
    margin: theme.spacing(1),
  },
}))

// note that these are currently put into the style section instead of being
// defined in classes to aid copy and paste to an external document e.g. word
const proteinColor = 'rgb(220,160,220)'
const intronColor = undefined
const cdsColor = 'rgb(220,220,180)'
const updownstreamColor = 'rgba(250,200,200)'
const utrColor = 'rgb(200,240,240)'

function GeneCDS({ cds, sequence }: { cds: Feat[]; sequence: string }) {
  return <span style={{ background: cdsColor }}>{stitch(cds, sequence)}</span>
}

function GeneProtein({
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

function GenecDNA({
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
interface SequencePanelProps {
  sequence: SeqState
  feature: ParentFeat
  mode: string
  intronBp: number
  codonTable: string
}
export const SequencePanel = React.forwardRef<
  HTMLDivElement,
  SequencePanelProps
>((props, ref) => {
  const { feature, mode, intronBp, codonTable: codonTablePre } = props
  let {
    sequence: { seq, upstream = '', downstream = '' },
  } = props
  const { subfeatures } = feature
  const codonTable = generateCodonTable(parseCodonTable(codonTablePre))

  if (!subfeatures) {
    return null
  }

  const children = subfeatures
    .sort((a, b) => a.start - b.start)
    .map(sub => ({
      ...sub,
      start: sub.start - feature.start,
      end: sub.end - feature.start,
    }))

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
    ;[seq, upstream, downstream] = [
      revcom(seq),
      revcom(downstream),
      revcom(upstream),
    ]
    cds = revlist(cds, seq.length)
    exons = revlist(exons, seq.length)
    utr = revlist(utr, seq.length)
  }

  return (
    <div ref={ref} data-testid="sequence_panel">
      <div
        style={{
          fontFamily: 'monospace',
          wordWrap: 'break-word',
          maxWidth: 600,
        }}
      >
        {`>${feature.name || feature.id || 'unknown'}-${mode}\n`}
        {mode === 'cds' ? (
          <GeneCDS cds={cds} sequence={seq} />
        ) : mode === 'cdna' ? (
          <GenecDNA
            exons={exons}
            cds={cds}
            utr={utr}
            sequence={seq}
            intronBp={intronBp}
          />
        ) : mode === 'protein' ? (
          <GeneProtein cds={cds} codonTable={codonTable} sequence={seq} />
        ) : mode === 'gene' ? (
          <GenecDNA
            exons={exons}
            cds={cds}
            utr={utr}
            sequence={seq}
            includeIntrons
            intronBp={intronBp}
          />
        ) : mode === 'gene_collapsed_intron' ? (
          <GenecDNA
            exons={exons}
            cds={cds}
            sequence={seq}
            utr={utr}
            includeIntrons
            collapseIntron
            intronBp={intronBp}
          />
        ) : mode === 'gene_updownstream' ? (
          <GenecDNA
            exons={exons}
            cds={cds}
            sequence={seq}
            utr={utr}
            upstream={upstream}
            downstream={downstream}
            includeIntrons
            intronBp={intronBp}
          />
        ) : mode === 'gene_updownstream_collapsed_intron' ? (
          <GenecDNA
            exons={exons}
            cds={cds}
            sequence={seq}
            utr={utr}
            upstream={upstream}
            downstream={downstream}
            includeIntrons
            collapseIntron
            intronBp={intronBp}
          />
        ) : (
          <div>Unknown type</div>
        )}
      </div>
    </div>
  )
})
// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
export default function SequenceFeatureDetails({ model, feature }: BaseProps) {
  const classes = useStyles()
  const parentFeature = feature as unknown as ParentFeat
  const hasCDS = parentFeature.subfeatures?.find(sub => sub.type === 'CDS')
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [settingsDlgOpen, setSettingsDlgOpen] = useState(false)

  const { ref, inView } = useInView()
  const [sequence, setSequence] = useState<SeqState>()
  const [error, setError] = useState<unknown>()
  const [mode, setMode] = useState(hasCDS ? 'cds' : 'cdna')
  const [copied, setCopied] = useState(false)
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [intronBp, setIntronBp] = useLocalStorage('intronBp', 5)
  const [upDownStreamBp, setUpDownStreamBp] = useLocalStorage(
    'updownstreamBp',
    500,
  )
  const [codonTable, setCodonTable] = useLocalStorage(
    'codonTable',
    defaultCodonTable,
  )

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
        regions: [
          {
            start,
            end,
            refName: assembly.getCanonicalRefName(refName),
          },
        ],
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
        const { start, end, refName } = feature as CoordFeat
        const seq = await fetchSeq(start, end, refName)
        const up = await fetchSeq(
          Math.max(0, start - upDownStreamBp),
          start,
          refName,
        )
        const down = await fetchSeq(end, end + upDownStreamBp, refName)
        if (!finished) {
          setSequence({ seq, upstream: up, downstream: down })
        }
      } catch (e) {
        setError(e)
      }
    })()

    return () => {
      finished = true
    }
  }, [feature, inView, model, upDownStreamBp])

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
          Gene w/ {intronBp}bp of intron
        </MenuItem>
        <MenuItem value="gene_updownstream">
          Gene w/ {upDownStreamBp}bp up+down stream
        </MenuItem>
        <MenuItem value="gene_updownstream_collapsed_intron">
          Gene w/ {upDownStreamBp}bp up+down stream w/ 10bp intron
        </MenuItem>
        <MenuItem value="cdna">cDNA</MenuItem>
      </Select>
      <IconButton onClick={() => setSettingsDlgOpen(true)}>
        <SettingsIcon />
      </IconButton>
      <Button
        className={classes.button}
        type="button"
        variant="contained"
        onClick={() => {
          const ref = seqPanelRef.current
          if (ref) {
            copy(ref.textContent || '', { format: 'text/plain' })
            setCopied(true)
            setTimeout(() => setCopied(false), 1000)
          }
        }}
      >
        {copied ? 'Copied to clipboard!' : 'Copy as plaintext'}
      </Button>
      <Tooltip title="Note that 'Copy as HTML' can retain the colors but cannot be pasted into some programs like notepad that only expect plain text">
        <Button
          className={classes.button}
          type="button"
          variant="contained"
          onClick={() => {
            const ref = seqPanelRef.current
            if (ref) {
              copy(ref.innerHTML, { format: 'text/html' })
              setCopiedHtml(true)
              setTimeout(() => setCopiedHtml(false), 1000)
            }
          }}
        >
          {copiedHtml ? 'Copied to clipboard!' : 'Copy as HTML'}
        </Button>
      </Tooltip>
      <>
        {error ? (
          <Typography color="error">{`${error}`}</Typography>
        ) : loading ? (
          <Typography>Loading gene sequence...</Typography>
        ) : sequence ? (
          <SequencePanel
            ref={seqPanelRef}
            feature={parentFeature}
            mode={mode}
            sequence={sequence}
            intronBp={intronBp}
            codonTable={codonTable}
          />
        ) : (
          <Typography>No sequence found</Typography>
        )}
      </>
      {settingsDlgOpen ? (
        <SettingsDlg
          handleClose={arg => {
            if (arg) {
              const { codonTable, upDownStreamBp, intronBp } = arg
              setCodonTable(codonTable)
              setIntronBp(intronBp)
              setUpDownStreamBp(upDownStreamBp)
            }
            setSettingsDlgOpen(false)
          }}
          upDownStreamBp={upDownStreamBp}
          codonTable={codonTable}
          intronBp={intronBp}
        />
      ) : null}
    </div>
  )
}
