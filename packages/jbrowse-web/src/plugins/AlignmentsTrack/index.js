import { types } from 'mobx-state-tree'

import Plugin, { TrackType } from '../../Plugin'
import { ConfigurationSchema } from '../../configuration'
import { BaseTrack as LinearGenomeTrack } from '../LinearGenomeView/models/model'
import AlignmentsTrack from './components/AlignmentsTrack'

const configSchema = ConfigurationSchema('AlignmentsTrack', {
  defaultView: {
    type: 'string',
    defaultValue: 'pileup',
  },
})

const stateModel = types.compose(
  'AlignmentsTrack',
  LinearGenomeTrack,
  types.model({ type: types.literal('AlignmentsTrack') }),
)

export default class AlignmentsTrackPlugin extends Plugin {
  install(browser) {
    this.browser = browser
    browser.addTrackType(
      () =>
        new TrackType({
          name: 'Alignments',
          configSchema,
          stateModel,
          RenderingComponent: AlignmentsTrack,
        }),
    )
  }
}
