import React, { useState, useEffect } from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'
import { Button, DialogContent } from '@mui/material'
import copy from 'copy-to-clipboard'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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

const RefNameInfoDialog = observer(function ({
  config,
  onClose,
}: {
  config: AnyConfigurationModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [refNames, setRefNames] = useState<Record<string, string[]>>()
  const [copied, setCopied] = useState(false)
  const { rpcManager } = getSession(config)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const map = await Promise.all(
          [...new Set(getConfAssemblyNames(config))].map(async assemblyName => {
            const adapterConfig = readConfObject(config, 'adapter')
            return [
              assemblyName,
              (await rpcManager.call(config.trackId, 'CoreGetRefNames', {
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
  }, [config, rpcManager])

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
              onClick={() => {
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
