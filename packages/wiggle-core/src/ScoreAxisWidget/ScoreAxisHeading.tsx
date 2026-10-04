import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util/mstUtils'
import { observer } from 'mobx-react'

import type { ScoreAxisWidgetModel } from './stateModel.ts'

export default observer(function ScoreAxisHeading({
  model,
}: {
  model: ScoreAxisWidgetModel
}) {
  const { display, label } = model
  return display
    ? `${label} — ${getConf(getContainingTrack(display), 'name')}`
    : label
})
