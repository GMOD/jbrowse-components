import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfSlot } from '@jbrowse/core/configuration'
import { ErrorBanner, LoadingEllipses } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util/useFetch'

import type { AboutPanelProps } from './util.ts'

type FileInfo = Record<string, unknown> | string

export default function FileInfoPanel({ config, session }: AboutPanelProps) {
  const { rpcManager } = session
  const trackId = readConfSlot<string>(config, 'trackId')

  const {
    data: info,
    error,
    isLoading,
  } = useFetch(
    ['CoreGetInfo', trackId],
    async () =>
      (await rpcManager.call(trackId, 'CoreGetInfo', {
        adapterConfig: readConfSlot<Record<string, unknown>>(config, 'adapter'),
      })) as FileInfo,
  )

  const details =
    typeof info === 'string'
      ? {
          header: `<pre>${info
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')}</pre>`,
        }
      : (info ?? {})

  return (
    <BaseCard title="File info">
      {error ? (
        <ErrorBanner error={error} />
      ) : isLoading ? (
        <LoadingEllipses message="Loading file data" />
      ) : (
        <Attributes attributes={details} />
      )}
    </BaseCard>
  )
}
