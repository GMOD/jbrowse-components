import { readConfObject } from '@jbrowse/core/configuration'
import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { createStatusFanOut, statusProgressLabel } from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AboutPanelProps } from './util.ts'

const MAX_REF_NAMES = 10_000

const useStyles = makeStyles()(theme => ({
  container: {
    minWidth: 800,
  },
  refNames: {
    maxHeight: 300,
    overflow: 'auto',
    flexGrow: 1,
    background: theme.palette.background.default,
  },
}))

function formatRefNames(
  data: readonly (readonly [string, string[]])[],
  truncate: boolean,
) {
  return data
    .flatMap(([assemblyName, names]) => [
      `--- ${assemblyName} ---`,
      ...(truncate ? names.slice(0, MAX_REF_NAMES) : names),
      truncate && names.length > MAX_REF_NAMES
        ? `\nToo many refNames to show in browser for ${assemblyName}, use "Copy ref names" button to copy to clipboard`
        : '',
    ])
    .filter(s => s !== '')
    .join('\n')
}

const RefNameInfoDialog = observer(function RefNameInfoDialog({
  config,
  session,
  onClose,
}: AboutPanelProps & { onClose: () => void }) {
  const { classes } = useStyles()
  const { rpcManager } = session
  const trackId = readConfObject(config, 'trackId') as string

  const { data, error, isLoading, status } = useFetch(
    ['CoreGetRefNames', trackId] as const,
    (_name, _trackId, signal, statusCallback) => {
      // one status slot per assembly, so N concurrent reads aggregate into one
      // bar instead of the last writer winning
      const slot = createStatusFanOut(statusCallback)
      // A `ReferenceSequenceTrack` config declares no `assemblyNames` slot: its
      // assembly is the config node holding it, which `getConfAssemblyNames`
      // walks to. It throws when a config has neither, and inside the fetcher
      // that lands in the error banner rather than out of a render
      return Promise.all(
        [...new Set(getConfAssemblyNames(config))].map(
          async assemblyName =>
            [
              assemblyName,
              await rpcManager.call(trackId, 'CoreGetRefNames', {
                adapterConfig: readConfObject(config, 'adapter'),
                assemblyName,
                signal,
                statusCallback: slot(),
              }),
            ] as const,
        ),
      )
    },
  )
  // undefined here means the key was incomplete and the fetch never ran, not
  // that one is still in flight — `isLoading` is what says that. Treating the
  // two as the same thing is what left the dialog spinning with nothing behind
  // it; an empty list at least says so
  const refNames = data ?? []

  return (
    <Dialog
      open
      title="Reference sequence names used in track"
      onClose={onClose}
      maxWidth="xl"
    >
      <DialogContent className={classes.container}>
        {error ? (
          <ErrorBanner error={error} />
        ) : isLoading ? (
          <LoadingEllipses
            message={statusProgressLabel(status) || 'Loading refNames'}
          />
        ) : (
          <>
            <CopyToClipboardButton
              variant="contained"
              value={() => formatRefNames(refNames, false)}
            >
              Copy ref names
            </CopyToClipboardButton>

            <pre className={classes.refNames}>
              {formatRefNames(refNames, true)}
            </pre>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})

export default RefNameInfoDialog
