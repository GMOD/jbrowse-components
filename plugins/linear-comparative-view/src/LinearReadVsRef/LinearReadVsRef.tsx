import { useState } from 'react'

import {
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
  getTag,
} from '@jbrowse/alignments-core'
import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage, NumberTextField } from '@jbrowse/core/ui'
import { getContainingView, getSession, useFetch } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material'

import { buildReadVsRefSpec } from './buildReadVsRefSpec.ts'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  root: {
    width: 300,
  },
})

async function fetchPrimaryAlignment(
  track: AbstractTrackModel,
  preFeature: Feature,
) {
  if (!((preFeature.get('flags') as number) & SAM_FLAG_SUPPLEMENTARY)) {
    return preFeature
  }
  const SA = (getTag(preFeature, 'SA') as string | undefined) ?? ''
  const primaryAln = SA.split(';', 1)[0]!
  const [saRef, saStart] = primaryAln.split(',')
  const session = getSession(track)
  const { rpcManager } = session
  const adapterConfig = getConf(track, 'adapter')
  const sessionId = getRpcSessionId(track)
  const [asm] = getConf(track, 'assemblyNames') as string[]
  // CRAM/BAM must decode the primary read's SEQ against the reference; the
  // adapter config doesn't carry it, so pass the assembly's sequence adapter.
  const sequenceAdapter = getSequenceAdapterConfig(
    asm ? session.assemblyManager.get(asm) : undefined,
  )
  const feats: Feature[] = await rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    sequenceAdapter,
    regions: [
      {
        refName: saRef!,
        start: +saStart! - 1,
        end: +saStart!,
        assemblyName: asm ?? '',
      },
    ],
  })
  const result = feats.find(
    f =>
      f.get('name') === preFeature.get('name') &&
      !((f.get('flags') as number) & SAM_FLAG_SUPPLEMENTARY) &&
      !((f.get('flags') as number) & SAM_FLAG_SECONDARY),
  )
  if (!result) {
    throw new Error('primary feature not found')
  }
  return result
}

export default function ReadVsRefDialog({
  track,
  feature: preFeature,
  handleClose,
}: {
  feature: Feature
  handleClose: () => void
  track: AbstractTrackModel
}) {
  const { classes } = useStyles()

  const [windowSize, setWindowSize] = useState<number | undefined>(0)
  const [submitError, setSubmitError] = useState<unknown>()

  const { data: primaryFeature, error: fetchError } = useFetch(
    ['primaryAlignment', preFeature.id()],
    () => fetchPrimaryAlignment(track, preFeature),
  )
  const error = submitError ?? fetchError

  async function onSubmit() {
    try {
      if (!primaryFeature || windowSize === undefined) {
        return
      }
      const session = getSession(track)
      const view = getContainingView(track) as { width: number }
      const [trackAssembly] = getConf(track, 'assemblyNames') as string[]
      const assembly = await session.assemblyManager.waitForAssembly(
        trackAssembly!,
      )
      if (!assembly) {
        throw new Error('assembly not found')
      }
      const sequenceTrackConf = getConf(assembly, 'sequence') as {
        trackId: string
      }

      const { temporaryAssembly, viewSpec } = buildReadVsRefSpec({
        primaryFeature,
        windowSize,
        viewWidth: view.width,
        trackAssembly: trackAssembly!,
        getCanonicalRefName: refName => assembly.getCanonicalRefName(refName),
        sequenceTrackConf,
        now: () => Date.now(),
        rand: () => Math.random(),
      })

      session.addTemporaryAssembly?.(temporaryAssembly)
      session.addView('LinearSyntenyView', viewSpec)
      handleClose()
    } catch (e) {
      console.error(e)
      setSubmitError(e)
    }
  }

  return (
    <Dialog open onClose={handleClose} title="Set window size">
      <DialogContent>
        {error ? (
          <ErrorMessage error={error} />
        ) : !primaryFeature ? (
          <div>
            <Typography>
              To accurately perform comparison we are fetching the primary
              alignment. Loading primary feature...
            </Typography>
            <CircularProgress />
          </div>
        ) : (
          <div className={classes.root}>
            {(primaryFeature.get('flags') as number) & SAM_FLAG_SECONDARY ? (
              <Typography style={{ color: 'orange' }}>
                Note: You selected a secondary alignment (which generally does
                not have SA tags or SEQ fields) so do a full reconstruction of
                the alignment
              </Typography>
            ) : null}
            <Typography>
              Show an extra window size around each part of the split alignment.
              Using a larger value can allow you to see more genomic context.
            </Typography>

            <NumberTextField
              defaultValue={0}
              min={0}
              onValueChange={setWindowSize}
              label="Set window size"
              errorText="Must be a non-negative number"
            />
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          disabled={!primaryFeature || windowSize === undefined}
          variant="contained"
          color="primary"
          onClick={() => {
            void onSubmit()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
