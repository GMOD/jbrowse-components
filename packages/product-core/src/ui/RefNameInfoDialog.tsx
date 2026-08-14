import { readConfSlot } from '@jbrowse/core/configuration'
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
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AboutConfig, AboutPanelProps } from './util.ts'

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

/**
 * A `ReferenceSequenceTrack` config declares no `assemblyNames` slot at all —
 * `createReferenceSeqTrackConfig` omits it deliberately, because such a track's
 * assembly is the config node holding it. `getConfAssemblyNames` is the shared
 * resolver that walks to that parent, and reading the slot directly instead is
 * what left "Show ref names" on every reference sequence track loading forever:
 * `undefined` serialized into the fetch key, which `useFetch` reads as "don't
 * fetch". It throws when a config has neither, which is why this is called
 * inside the fetcher — an unanswerable question belongs in the error banner
 * rather than thrown out of a render.
 */
function aboutAssemblyNames(config: AboutConfig) {
  return isStateTreeNode(config)
    ? getConfAssemblyNames(config)
    : (readConfSlot<string[] | undefined>(config, 'assemblyNames') ?? [])
}

const RefNameInfoDialog = observer(function RefNameInfoDialog({
  config,
  session,
  onClose,
}: AboutPanelProps & { onClose: () => void }) {
  const { classes } = useStyles()
  const { rpcManager } = session
  const trackId = readConfSlot<string>(config, 'trackId')

  const { data, error, isLoading, status } = useFetch(
    ['CoreGetRefNames', trackId] as const,
    (_name, _trackId, stopToken, statusCallback) => {
      // one status slot per assembly, so N concurrent reads aggregate into one
      // bar instead of the last writer winning
      const slot = createStatusFanOut(statusCallback)
      return Promise.all(
        [...new Set(aboutAssemblyNames(config))].map(
          async assemblyName =>
            [
              assemblyName,
              await rpcManager.call(trackId, 'CoreGetRefNames', {
                adapterConfig: readConfSlot<Record<string, unknown>>(
                  config,
                  'adapter',
                ),
                assemblyName,
                stopToken,
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
