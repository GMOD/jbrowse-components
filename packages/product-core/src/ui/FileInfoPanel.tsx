import React, { useState, useEffect } from 'react'
import { Typography } from '@mui/material'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getSession } from '@jbrowse/core/util'
import {
  BaseCard,
  Attributes,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

type FileInfo = Record<string, unknown> | string

export default function FileInfoPanel({
  config,
}: {
  config: AnyConfigurationModel
}) {
  const [error, setError] = useState<unknown>()
  const [info, setInfo] = useState<FileInfo>()
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
        const result = await rpcManager.call(config.trackId, 'CoreGetInfo', {
          adapterConfig,
          signal,
        })
        if (!cancelled) {
          setInfo(result as FileInfo)
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

  const details =
    typeof info === 'string'
      ? {
          header: `<pre>${info
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</pre>`,
        }
      : info || {}

  return info !== null ? (
    <BaseCard title="File info">
      {error ? (
        <Typography color="error">{`${error}`}</Typography>
      ) : info === undefined ? (
        <LoadingEllipses message="Loading file data" />
      ) : (
        <Attributes attributes={details} />
      )}
    </BaseCard>
  ) : null
}
