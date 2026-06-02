import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { readConf } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
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
}: {
  config: AnyConfigurationModel | Record<string, unknown>
  session: AbstractSessionModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  const { rpcManager } = session
  const trackId = readConf<string>(config, 'trackId')
  const assemblyNames = readConf<string[]>(config, 'assemblyNames')

  const { data: refNames, error, isLoading } = useFetch(
    ['CoreGetRefNames', trackId, JSON.stringify(assemblyNames)],
    () =>
      Promise.all(
        [...new Set(assemblyNames)].map(
          async assemblyName =>
            [
              assemblyName,
              await rpcManager.call(trackId, 'CoreGetRefNames', {
                adapterConfig: readConf<Record<string, unknown>>(
                  config,
                  'adapter',
                ),
                assemblyName,
              }),
            ] as const,
        ),
      ),
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
        ) : isLoading || refNames === undefined ? (
          <LoadingEllipses message="Loading refNames" />
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
