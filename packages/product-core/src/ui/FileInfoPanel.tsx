import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorBanner, LoadingEllipses } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util'

import { readConfSlot } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

type FileInfo = Record<string, unknown> | string

export default function FileInfoPanel({
  config,
  session,
}: {
  config: AnyConfigurationModel | Record<string, unknown>
  session: AbstractSessionModel
}) {
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
