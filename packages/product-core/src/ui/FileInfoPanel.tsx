import React, { useState, useEffect } from 'react'
import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const adapterConfig = readConfObject(config, 'adapter')
        const result = await rpcManager.call(config.trackId, 'CoreGetInfo', {
          adapterConfig,
        })
        setInfo(result as FileInfo)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [config, rpcManager])

  const details =
    typeof info === 'string'
      ? {
          header: `<pre>${info
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')}</pre>`,
        }
      : info || {}

  return (
    <BaseCard title="File info">
      {error ? (
        <ErrorMessage error={error} />
      ) : info === undefined ? (
        <LoadingEllipses message="Loading file data" />
      ) : (
        <Attributes attributes={details} />
      )}
    </BaseCard>
  )
}
