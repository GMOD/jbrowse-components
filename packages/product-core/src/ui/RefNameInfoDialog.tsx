import { assemblyContigLengths } from '@jbrowse/core/assemblyManager/assembly'
import { readConfObject } from '@jbrowse/core/configuration'
import { withAdapterSession } from '@jbrowse/core/data_adapters/adapterSessionRefcount'
import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { createStatusFanOut, statusProgressLabel } from '@jbrowse/core/util'
import {
  getConfAssemblyNames,
  getConfRpcSessionId,
} from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AboutPanelProps } from './util.ts'
import type { ContigColumns } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AbstractSessionModel } from '@jbrowse/core/util'

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

/**
 * Each contig on a line, then the length the file states, then the
 * assembly's where the two differ.
 */
function contigLines(
  session: AbstractSessionModel,
  assemblyName: string,
  { refNames, lengths }: ContigColumns,
) {
  const { assemblyManager } = session
  const assembly = assemblyManager.has(assemblyName)
    ? assemblyManager.get(assemblyName)
    : undefined
  const assemblyLengths = assemblyContigLengths(assembly?.regions ?? [])
  return refNames.map((refName, i) => {
    const length = lengths[i]
    const canonical = assembly?.getCanonicalRefName2(refName) ?? refName
    const assemblyLength = assemblyLengths.get(canonical)
    return length === undefined
      ? refName
      : assemblyLength === undefined || assemblyLength === length
        ? `${refName}\t${length}`
        : `${refName}\t${length}\tassembly: ${assemblyLength}`
  })
}

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
  const adapterConfig = readConfObject(config, 'adapter')
  const sessionId = getConfRpcSessionId(config)

  const { data, error, isLoading, status } = useFetch(
    ['CoreGetContigs', sessionId] as const,
    (_name, _sessionId, signal, statusCallback) => {
      // one status slot per assembly, so N concurrent reads aggregate into one
      // bar instead of the last writer winning
      const slot = createStatusFanOut(statusCallback)
      // A `ReferenceSequenceTrack` config declares no `assemblyNames` slot: its
      // assembly is the config node holding it, which `getConfAssemblyNames`
      // walks to. It throws when a config has neither, and inside the fetcher
      // that lands in the error banner rather than out of a render
      return withAdapterSession(rpcManager, sessionId, () =>
        Promise.all(
          [...new Set(getConfAssemblyNames(config))].map(
            async assemblyName =>
              [
                assemblyName,
                await rpcManager.call(sessionId, 'CoreGetContigs', {
                  adapterConfig,
                  assemblyName,
                  signal,
                  statusCallback: slot(),
                }),
              ] as const,
          ),
        ),
      )
    },
  )
  // undefined here means the key was incomplete and the fetch never ran, not
  // that one is still in flight — `isLoading` is what says that. Treating the
  // two as the same thing is what left the dialog spinning with nothing behind
  // it; an empty list at least says so
  const contigs = data ?? []
  const refNames = contigs.map(
    ([assemblyName, list]) => [assemblyName, list.refNames] as const,
  )
  const lines = contigs.map(
    ([assemblyName, list]) =>
      [assemblyName, contigLines(session, assemblyName, list)] as const,
  )

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
              {formatRefNames(lines, true)}
            </pre>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})

export default RefNameInfoDialog
