import React, { useState, useEffect } from 'react'
import { Button, Typography } from '@mui/material'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getSession } from '@jbrowse/core/util'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import FieldName from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FieldName'
import copy from 'copy-to-clipboard'

const MAX_REF_NAMES = 10_000

const useStyles = makeStyles()(theme => ({
  refNames: {
    maxHeight: 300,
    overflow: 'auto',
    flexGrow: 1,
    background: theme.palette.background.default,
  },
  button: {
    float: 'right',
  },
}))

const RefNamePanel = observer(function ({
  config,
}: {
  config: AnyConfigurationModel
}) {
  const [error, setError] = useState<unknown>()
  const [refNames, setRefNames] = useState<string[]>()
  const [copied, setCopied] = useState(false)
  const { classes } = useStyles()
  const session = getSession(config)
  const { rpcManager } = session

  useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const adapterConfig = readConfObject(config, 'adapter')
        const refNames = await rpcManager.call(
          config.trackId,
          'CoreGetRefNames',
          {
            adapterConfig,
            signal,
          },
        )
        if (!cancelled) {
          setRefNames(refNames as string[])
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e)
          setError(e)
        }
      }
    })()

    return () => {
      aborter.abort()
      cancelled = true
    }
  }, [config, rpcManager])

  return (
    <BaseCard title="Reference sequences in track">
      {error ? (
        <Typography color="error">{`${error}`}</Typography>
      ) : refNames === undefined ? (
        <LoadingEllipses message="Loading refNames" />
      ) : (
        <>
          <Button
            variant="contained"
            className={classes.button}
            onClick={() => {
              copy(JSON.stringify(refNames.join('\n'), null, 2))
              setCopied(true)
              setTimeout(() => setCopied(false), 1000)
            }}
          >
            {copied ? 'Copied to clipboard!' : 'Copy ref names'}
          </Button>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <FieldName name="refNames" />
            <pre className={classes.refNames}>
              {refNames.slice(0, MAX_REF_NAMES).join('\n')}
              {refNames.length > MAX_REF_NAMES
                ? '\nToo many refNames to show in browser, use "Copy ref names" button to copy to clipboard'
                : ''}
            </pre>
          </div>
        </>
      )}
    </BaseCard>
  )
})

export default RefNamePanel
