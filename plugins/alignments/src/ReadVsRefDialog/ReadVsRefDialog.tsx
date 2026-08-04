import { useState } from 'react'

import { SAM_FLAG_SECONDARY } from '@jbrowse/cigar-utils'
import {
  ErrorMessage,
  NumberTextField,
  ReplaceCurrentViewButton,
  SubmitDialog,
} from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isSessionWithViewReplacement,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { CircularProgress, Typography } from '@mui/material'

import { fetchPrimaryAlignment } from './fetchPrimaryAlignment.ts'

import type { ReadVsRefLaunchArgs } from './index.ts'
import type {
  AbstractTrackModel,
  AbstractViewModel,
  Feature,
} from '@jbrowse/core/util'

const useStyles = makeStyles()({
  root: {
    width: 300,
  },
})

/**
 * The launch dialog every "read vs ref" view shares: it resolves the clicked
 * read to its primary alignment and collects a window size, then hands both to
 * the caller's `onSubmit`, which is the only view-specific part. Keeping one
 * dialog is what stops the linear and dotplot launchers drifting into different
 * read coordinate systems for the same read.
 */
export default function ReadVsRefDialog({
  track,
  feature: preFeature,
  handleClose,
  onSubmit: launch,
}: {
  feature: Feature
  handleClose: () => void
  track: AbstractTrackModel
  onSubmit: (args: ReadVsRefLaunchArgs) => void | Promise<void>
}) {
  const { classes } = useStyles()

  const [windowSize, setWindowSize] = useState<number | undefined>(0)
  const [submitError, setSubmitError] = useState<unknown>()
  // Read off the track rather than passed in: both launchers already resolve
  // the same two from it, and a dialog that took them as props would let a
  // caller hand over a view the read was not clicked in.
  const sourceView = getContainingView(track)
  const canReplace = isSessionWithViewReplacement(getSession(track))

  const { data: primaryFeature, error: fetchError } = useFetch(
    ['primaryAlignment', preFeature.id()],
    () => fetchPrimaryAlignment(track, preFeature),
  )
  const error = submitError ?? fetchError

  const disabled = !primaryFeature || windowSize === undefined

  async function onSubmit(replacing?: AbstractViewModel) {
    try {
      if (!primaryFeature || windowSize === undefined) {
        return
      }
      await launch({ primaryFeature, windowSize, track, replacing })
      handleClose()
    } catch (e) {
      console.error(e)
      setSubmitError(e)
    }
  }

  return (
    <SubmitDialog
      open
      title="Set window size"
      submitDisabled={disabled}
      // The read-vs-ref view is anchored on the read the launching view is
      // already showing, so replacing that view is as reasonable an outcome as
      // appending below it — the same choice the synteny launches offer, in the
      // same words. Named only when both are on offer; otherwise Submit is the
      // only button and "Submit" is what it has always said.
      submitText={canReplace ? 'Open in new view' : undefined}
      actions={
        canReplace ? (
          <ReplaceCurrentViewButton
            disabled={disabled}
            onClick={() => {
              void onSubmit(sourceView)
            }}
          />
        ) : null
      }
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        void onSubmit()
      }}
    >
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
            <Typography color="warning">
              Note: You selected a secondary alignment (which generally does not
              have SA tags or SEQ fields) so do a full reconstruction of the
              alignment
            </Typography>
          ) : null}
          <Typography>
            Show an extra window size around each part of the split alignment.
            Using a larger value can allow you to see more genomic context.
          </Typography>

          <NumberTextField
            defaultValue={0}
            min={0}
            onValueChange={val => {
              setWindowSize(val)
            }}
            label="Set window size"
            errorText="Must be a non-negative number"
          />
        </div>
      )}
    </SubmitDialog>
  )
}
