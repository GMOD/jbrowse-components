import { pluralize } from '@jbrowse/core/util'

import TrackControl from './trackControl/TrackControl.tsx'

/**
 * The corner notice for a display whose config says something it cannot draw
 * as written, one line per problem. Renders nothing when there is none.
 *
 * `onClick` makes it a door: a display with an editor for the config it is
 * complaining about opens it here. Without one the notice only reports, which
 * is what every display but the mark display does.
 */
export default function ConfigProblemsIndicator({
  notices,
  onClick,
}: {
  notices: readonly string[]
  onClick?: () => void
}) {
  return notices.length > 0 ? (
    <TrackControl
      icon="filter"
      warning
      label={`${notices.length} config ${pluralize(notices.length, 'problem')}`}
      tooltip={notices.join('; ')}
      onClick={onClick}
    />
  ) : null
}
