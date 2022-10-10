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
import copy from 'copy-to-clipboard'

// locals
import SettingsDlg from './SequenceFeatureSettingsDialog'
import SequencePanel from './SequencePanel'
import { getSession, useLocalStorage } from '../util'
import { BaseProps } from './types'
import { getConf } from '../configuration'
import { Feature, SimpleFeatureSerialized } from '../util/simpleFeature'
import { ParentFeat, SeqState, ErrorState } from './util'

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
  container2: {
    marginTop: theme.spacing(1),
  },
}))

const BPLIMIT = 500_000

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

  const [shown, setShown] = useState(false)
  const [sequence, setSequence] = useState<SeqState | ErrorState>()
  const [error, setError] = useState<unknown>()
  const [copied, setCopied] = useState(false)
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [intronBp, setIntronBp] = useLocalStorage('intronBp', 10)
  const [upDownBp, setUpDownBp] = useLocalStorage('upDownBp', 500)
  const [forceLoad, setForceLoad] = useState({
    id: feature.uniqueId,
    force: false,
  })

  useEffect(() => {
    setForceLoad({ id: feature.uniqueId, force: false })
  }, [feature])

  useEffect(() => {
    let finished = false
    if (!model || !shown) {
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
      return (feat?.get('seq') as string) || ''
    }

    ;(async () => {
      try {
        setError(undefined)
        const { start, end, refName } = feature as CoordFeat

        if (!forceLoad.force && end - start > BPLIMIT) {
          setSequence({
            error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
          })
        } else {
          const seq = await fetchSeq(start, end, refName)
          const up = await fetchSeq(
            Math.max(0, start - upDownBp),
            start,
            refName,
          )
          const down = await fetchSeq(end, end + upDownBp, refName)
          if (!finished) {
            setSequence({ seq, upstream: up, downstream: down })
          }
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()

    return () => {
      finished = true
    }
  }, [feature, shown, model, upDownBp, forceLoad])

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
  const val = attemptGeneType ? (hasCDS ? 'cds' : 'cdna') : 'genomic'

  // this useEffect is needed to reset the mode/setMode useState because the contents of the select box can completely change depending on whether we click on a gene feature or non-gene feature, so the current value in the select box must change accordingly
  useEffect(() => {
    setMode(val)
  }, [attemptGeneType, val])

  const [mode, setMode] = useState(
    attemptGeneType ? (hasCDS ? 'cds' : 'cdna') : 'genomic',
  )

  const rest = {
    gene: 'Gene w/ introns',
    gene_collapsed_intron: `Gene w/ ${intronBp}bp of intron`,
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
        genomic: 'Genomic seq',
        genomic_sequence_updown: `Genomic seq w/ ${upDownBp}bp up+down stream`,
      }

  return (isGene && !hasCDS) || !model ? null : (
    <div className={classes.container2}>
      <Button variant="contained" onClick={() => setShown(!shown)}>
        {shown ? 'Hide feature sequence' : 'Show feature sequence'}
      </Button>
      <br />
      {shown ? (
        <div className={classes.container2}>
          <FormControl className={classes.formControl}>
            <Select
              value={mode}
              onChange={event => setMode(event.target.value)}
            >
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
              color="inherit"
              onClick={() => {
                const ref = seqPanelRef.current
                if (ref) {
                  copy(ref.textContent || '', { format: 'text/plain' })
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1000)
                }
              }}
            >
              {copied ? 'Copied to clipboard!' : 'Copy plaintext'}
            </Button>
          </FormControl>
          <FormControl className={classes.formControl}>
            <Tooltip title="The 'Copy HTML' function retains the colors from the sequence panel but cannot be pasted into some programs like notepad that only expect plain text">
              <Button
                className={classes.button}
                variant="contained"
                color="inherit"
                onClick={() => {
                  const ref = seqPanelRef.current
                  if (ref) {
                    copy(ref.innerHTML, { format: 'text/html' })
                    setCopiedHtml(true)
                    setTimeout(() => setCopiedHtml(false), 1000)
                  }
                }}
              >
                {copiedHtml ? 'Copied to clipboard!' : 'Copy HTML'}
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
              'error' in sequence ? (
                <>
                  <Typography color="error">{sequence.error}</Typography>
                  <Button
                    variant="contained"
                    color="inherit"
                    onClick={() => setForceLoad({ ...forceLoad, force: true })}
                  >
                    Force load
                  </Button>
                </>
              ) : (
                <SequencePanel
                  ref={seqPanelRef}
                  feature={parentFeature}
                  mode={mode}
                  sequence={sequence}
                  intronBp={intronBp}
                />
              )
            ) : (
              <Typography>No sequence found</Typography>
            )}
          </>
        </div>
      ) : null}

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
