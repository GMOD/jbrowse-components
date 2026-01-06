import { useEffect, useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogContent } from '@mui/material'
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
  const [error, setError] = useState<unknown>()
  const [refNames, setRefNames] = useState<Record<string, string[]>>()
  const [copied, setCopied] = useState(false)
  const { rpcManager } = session
  const trackId = readConf(config, 'trackId') as string
  const assemblyNames = readConf(config, 'assemblyNames') as string[]

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const map = await Promise.all(
          [...new Set(assemblyNames)].map(async assemblyName => {
            const adapterConfig = readConf(config, 'adapter')
            return [
              assemblyName,
              (await rpcManager.call(trackId, 'CoreGetRefNames', {
                adapterConfig,
                // hack for synteny adapters
                regions: [
                  {
                    assemblyName,
                  },
                ],
              })) as string[],
            ] as const
          }),
        )
        setRefNames(Object.fromEntries(map))
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [config, rpcManager, trackId, assemblyNames])

  const names = refNames ? Object.entries(refNames) : []
  const result = names
    .flatMap(([assemblyName, refNames]) => {
      return [
        `--- ${assemblyName} ---`,
        ...refNames.slice(0, MAX_REF_NAMES),
        refNames.length > MAX_REF_NAMES
          ? `\nToo many refNames to show in browser for ${assemblyName}, use "Copy ref names" button to copy to clipboard`
          : '',
      ]
    })
    .filter(f => !!f)
    .join('\n')

  return (
    <Dialog
      open
      title="Reference sequence names used in track"
      onClose={onClose}
      maxWidth="xl"
    >
      <DialogContent className={classes.container}>
        {error ? (
          <ErrorMessage error={error} />
        ) : refNames === undefined ? (
          <LoadingEllipses message="Loading refNames" />
        ) : (
          <>
            <Button
              variant="contained"
              onClick={async () => {
                const { default: copy } = await import('copy-to-clipboard')
                copy(
                  names
                    .flatMap(([assemblyName, refNames]) => [
                      `--- ${assemblyName} ---`,
                      ...refNames,
                    ])
                    .filter(f => !!f)
                    .join('\n'),
                )
                setCopied(true)
                setTimeout(() => {
                  setCopied(false)
                }, 1000)
              }}
            >
              {copied ? 'Copied to clipboard!' : 'Copy ref names'}
            </Button>

            <pre className={classes.refNames}>{result}</pre>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})

export default RefNameInfoDialog
