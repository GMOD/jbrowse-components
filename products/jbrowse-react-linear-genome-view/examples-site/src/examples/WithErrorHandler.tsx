import { ErrorBanner } from '@jbrowse/core/ui'
import { useCreateOnce } from '@jbrowse/core/util/hooks'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

export default function WithErrorHandler() {
  const result = useCreateOnce<{ viewState: ViewModel } | { error: unknown }>(
    () => {
      try {
        return {
          viewState: createViewState({
            assembly: {
              name: 'volvox',
              uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
            },
            tracks: [
              {
                type: 'BadTrack',
                notProperTrack: 'error',
                shouldHaveTrackIdAndStuff: 'test',
              },
            ],
            location: 'ctgA:1105..1221',
          }),
        }
      } catch (error) {
        return { error }
      }
    },
  )
  return 'error' in result ? (
    <ErrorBanner error={result.error} />
  ) : (
    <JBrowseLinearGenomeView viewState={result.viewState} />
  )
}
