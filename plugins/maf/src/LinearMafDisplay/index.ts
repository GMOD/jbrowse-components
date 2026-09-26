import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'
import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ReactComponent = lazyWithPreload(
  () => import('./components/LinearMafDisplayComponent.tsx'),
)

export default function LinearMafDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF()
    return new DisplayType({
      name: 'LinearMafDisplay',
      configSchema,
      // lazily loaded: the model chunk is fetched when a MAF track is shown
      // or a session names this display, keeping it out of the initial bundle
      stateModel: () =>
        import('./stateModel.ts').then(f => f.default(configSchema)),
      ReactComponent,
      viewType: 'LinearGenomeView',
      trackType: 'MafTrack',
      displayName: 'MAF display',
      retiredState: {
        keys: RETIRED_ROW_STATE_KEYS,
        lift: liftRetiredRowState,
      },
    })
  })
}
