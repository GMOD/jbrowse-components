import React, { useRef, useState, useEffect } from 'react'
import {
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
  Tooltip,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { useInView } from 'react-intersection-observer'
import copy from 'copy-to-clipboard'

// locals
import SettingsDlg from './SequenceFeatureSettingsDialog'
import {
  defaultCodonTable,
  generateCodonTable,
  revcom,
  getSession,
  useLocalStorage,
} from '../util'
import { BaseProps } from './types'
import { getConf } from '../configuration'
import { Feature, SimpleFeatureSerialized } from '../util/simpleFeature'
import { ParentFeat, SeqState, calculateUTRs, dedupe, revlist } from './util'
import { GenecDNA, GeneProtein, GeneCDS, Genomic } from './GeneSequencePanel'

// icons
import SettingsIcon from '@mui/icons-material/Settings'

interface CoordFeat extends SimpleFeatureSerialized {
  refName: string
  start: number
  end: number
}

const useStyles = makeStyles()(theme => ({
  button: {
    margin: theme.spacing(1),
  },
  formControl: {
    margin: 0,
  },
  container: {
    margin: theme.spacing(1),
  },
}))

interface SequencePanelProps {
  sequence: SeqState
  feature: ParentFeat
  mode: string
  intronBp?: number
}
export const SequencePanel = React.forwardRef<
  HTMLDivElement,
  SequencePanelProps
>((props, ref) => {
  const { feature, mode, intronBp = 10 } = props
  let {
    sequence: { seq, upstream = '', downstream = '' },
  } = props
  const { subfeatures = [] } = feature

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
  const codonTable = generateCodonTable(defaultCodonTable)

  return (
    <div ref={ref} data-testid="sequence_panel">
      <div
        style={{
          fontFamily: 'monospace',
          wordWrap: 'break-word',
          fontSize: 12,
          maxWidth: 600,
        }}
      >
        {`>${
          feature.name || feature.id || feature.parentId || 'unknown'
        }-${mode}\n`}
        {mode === 'genomic' ? (
          <Genomic sequence={seq} />
        ) : mode === 'genomic_sequence_updown' ? (
          <Genomic sequence={seq} upstream={upstream} downstream={downstream} />
        ) : mode === 'cds' ? (
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
  const { classes } = useStyles()
  const parentFeature = feature as unknown as ParentFeat
  const hasCDS = !!parentFeature.subfeatures?.find(sub => sub.type === 'CDS')
  const isGene = feature.type === 'gene'
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [settingsDlgOpen, setSettingsDlgOpen] = useState(false)

  const { ref, inView } = useInView()
  const [sequence, setSequence] = useState<SeqState>()
  const [error, setError] = useState<unknown>()
  const [copied, setCopied] = useState(false)
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [intronBp, setIntronBp] = useLocalStorage('intronBp', 10)
  const [upDownBp, setUpDownBp] = useLocalStorage('upDownBp', 500)

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
        const up = await fetchSeq(Math.max(0, start - upDownBp), start, refName)
        const down = await fetchSeq(end, end + upDownBp, refName)
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
  }, [feature, inView, model, upDownBp])

  const loading = !sequence

  const session = getSession(model)
  const defaultSeqTypes = ['mRNA', 'transcript', 'gene']
  const sequenceTypes =
    getConf(session, ['featureDetails', 'sequenceTypes']) || defaultSeqTypes

  // only attempt fetching gene type sequence on a bare CDS if it has no parent
  const attemptGeneType =
    feature.type === 'CDS'
      ? sequenceTypes.includes('CDS') && !feature.parentId
      : sequenceTypes.includes(feature.type)

  const [mode, setMode] = useState(
    attemptGeneType ? (hasCDS ? 'cds' : 'cdna') : 'genomic',
  )

  const rest = {
    gene: 'Gene w/ introns',
    gene_collapsed_intron: `Gene w/ ${intronBp} of intron`,
    gene_updownstream: `Gene w/ ${upDownBp}bp up+down stream`,
    gene_updownstream_collapsed_intron: `Gene w/ ${upDownBp}bp up+down stream w/ ${intronBp}bp intron`,
    cdna: 'cDNA',
  }

  const arg = attemptGeneType
    ? hasCDS
      ? {
          cds: 'CDS',
          protein: 'Protein',
          ...rest,
        }
      : rest
    : {
        genomic: 'Feature sequence',
        genomic_sequence_updown: `Feature sequence w/ ${upDownBp}bp up+down stream`,
      }

  console.log({
    isGene,
    h: !hasCDS,
    m: !model,
    k: (isGene && !hasCDS) || !model,
    model,
  })

  return (isGene && !hasCDS) || !model ? null : (
    <div ref={ref} className={classes.container}>
      <FormControl className={classes.formControl}>
        <Select value={mode} onChange={event => setMode(event.target.value)}>
          {Object.entries(arg).map(([key, val]) => (
            <MenuItem key={key} value={key}>
              {val}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl className={classes.formControl}>
        <Button
          className={classes.button}
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
      </FormControl>
      <FormControl className={classes.formControl}>
        <Tooltip title="Note that 'Copy as HTML' can retain the colors but cannot be pasted into some programs like notepad that only expect plain text">
          <Button
            className={classes.button}
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
      </FormControl>
      <FormControl className={classes.formControl}>
        <IconButton onClick={() => setSettingsDlgOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </FormControl>
      <br />
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
          />
        ) : (
          <Typography>No sequence found</Typography>
        )}
      </>
      {settingsDlgOpen ? (
        <SettingsDlg
          handleClose={arg => {
            if (arg) {
              const { upDownBp, intronBp } = arg
              setIntronBp(intronBp)
              setUpDownBp(upDownBp)
            }
            setSettingsDlgOpen(false)
          }}
          upDownBp={upDownBp}
          intronBp={intronBp}
        />
      ) : null}
    </div>
  )
}
