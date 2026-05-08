import { useState } from 'react'

import { Dialog, ErrorBanner, LoadingEllipses } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogContent } from '@mui/material'
import copy from 'copy-to-clipboard'
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
  const [copied, setCopied] = useState(false)
  const { rpcManager } = session
  const trackId = readConf<string>(config, 'trackId')
  const assemblyNames = readConf<string[]>(config, 'assemblyNames')

  const { data: refNames, error } = useFetch(
    ['CoreGetRefNames', trackId, JSON.stringify(assemblyNames)],
    () =>
      Promise.all(
        [...new Set(assemblyNames)].map(
          async assemblyName =>
            [
              assemblyName,
              (await rpcManager.call(trackId, 'CoreGetRefNames', {
                adapterConfig: readConf<Record<string, unknown>>(config, 'adapter'),
                regions: [{ assemblyName }],
              })) as string[],
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
        ) : refNames === undefined ? (
          <LoadingEllipses message="Loading refNames" />
        ) : (
          <>
            <Button
              variant="contained"
              onClick={async () => {
                await copy(formatRefNames(refNames, false))
                setCopied(true)
                setTimeout(() => {
                  setCopied(false)
                }, 1000)
              }}
            >
              {copied ? 'Copied to clipboard!' : 'Copy ref names'}
            </Button>

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
