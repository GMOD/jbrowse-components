import { pluralize } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import BottomRightIndicators from './BottomRightIndicators.tsx'
import { openPlotDialog } from './plotMenu.ts'
import TrackControl from './trackControl/TrackControl.tsx'

import type { PlotDisplay } from './plotMenu.ts'

/**
 * The corner notice for a display whose config says something it cannot draw
 * as written, one line per problem. Renders nothing when there is none.
 *
 * `onClick` makes it a door to the editor for the config it is complaining
 * about. Without one the notice only reports.
 */
const ConfigProblemsIndicator = observer(function ConfigProblemsIndicator({
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
})

export default ConfigProblemsIndicator

/**
 * A display's notice chip in its bottom-right corner: `cornerNotices` where
 * the display has them, else `notices`. A click opens the display's plot form
 * where it has one, else "Edit plot..." on a display declaring plot settings.
 * `DisplayChrome` renders it for every display, as an observer of its own so
 * the chrome's render reads none of it.
 */
export const ConfigProblemsCorner = observer(function ConfigProblemsCorner({
  model,
}: {
  model: object
}) {
  const display = model as CornerModel
  const notices = display.cornerNotices ?? display.notices ?? []
  const onClick = display.openPlotForm
    ? () => {
        display.openPlotForm!(display.plot)
      }
    : display.plotKeys?.length
      ? () => {
          openPlotDialog(display as unknown as PlotDisplay)
        }
      : undefined
  return notices.length > 0 ? (
    <BottomRightIndicators scrollableHeight={display.scrollableHeight}>
      <ConfigProblemsIndicator notices={notices} onClick={onClick} />
    </BottomRightIndicators>
  ) : null
})

interface CornerModel {
  cornerNotices?: readonly string[]
  notices?: readonly string[]
  scrollableHeight?: number
  plotKeys?: readonly string[]
  plot?: unknown
  openPlotForm?: (draft: unknown) => void
}
