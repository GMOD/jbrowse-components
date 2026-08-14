import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfSlot } from '@jbrowse/core/configuration'
import { ErrorBanner, LoadingEllipses } from '@jbrowse/core/ui'
import { statusProgressLabel } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { observer } from 'mobx-react'

import type { AboutPanelProps } from './util.ts'

type FileInfo = Record<string, unknown> | string

// Inline `observer(function(){})`, not a bare declaration: this reads
// observables (session.rpcManager, and config slots off what is usually a live
// MST node), and babel-plugin-react-compiler compiles the bare form and can
// memoize such a read into staleness. RefNameInfoDialog beside it is written
// the same way; see the React Compiler x MobX note in CLAUDE.md
const FileInfoPanel = observer(function FileInfoPanel({
  config,
  session,
}: AboutPanelProps) {
  const { rpcManager } = session
  const trackId = readConfSlot<string>(config, 'trackId')

  const {
    data: info,
    error,
    isLoading,
    status,
  } = useFetch(
    ['CoreGetInfo', trackId] as const,
    // reading a header can mean walking a v8 .hic's norm-vector index or a
    // multi-megabyte VCF header, so it gets both handles: closing the About
    // dialog stops it, and the wait says what it is
    async (_name, _trackId, stopToken, statusCallback) =>
      (await rpcManager.call(trackId, 'CoreGetInfo', {
        adapterConfig: readConfSlot<Record<string, unknown>>(config, 'adapter'),
        stopToken,
        statusCallback,
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

  // `BaseFeatureDataAdapter.getHeader` returns null unless an adapter overrides
  // it, and `CoreGetInfo` returns null outright for anything that isn't a
  // feature adapter — so most tracks reached this with nothing to say and got a
  // FILE INFO heading with blank space under it. A panel with no content is not
  // a panel
  const empty = Object.values(details).every(v => v == null)
  if (!error && !isLoading && empty) {
    return null
  }

  return (
    <BaseCard title="File info">
      {error ? (
        <ErrorBanner error={error} />
      ) : isLoading ? (
        <LoadingEllipses
          message={statusProgressLabel(status) || 'Loading file data'}
        />
      ) : (
        <Attributes attributes={details} />
      )}
    </BaseCard>
  )
})

export default FileInfoPanel
