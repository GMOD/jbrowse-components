import { pluralize } from '@jbrowse/core/util'

import TrackControl from './trackControl/TrackControl.tsx'

/**
 * The corner notice for a display whose config says something it cannot draw
 * as written, one line per problem. Renders nothing when there is none.
 */
export default function ConfigProblemsIndicator({
  notices,
}: {
  notices: readonly string[]
}) {
  return notices.length > 0 ? (
    <TrackControl
      icon="filter"
      warning
      label={`${notices.length} config ${pluralize(notices.length, 'problem')}`}
      tooltip={notices.join('; ')}
    />
  ) : null
}
