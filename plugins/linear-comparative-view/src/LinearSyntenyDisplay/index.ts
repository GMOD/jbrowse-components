import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF()
    return new DisplayType({
      name: 'LinearSyntenyDisplay',
      configSchema,
      // lazily loaded: fetched when a synteny track is shown or a session names
      // this display. The view's own SyntenyFollow does hold a value edge into
      // this model, so it rides the LinearSyntenyView chunk rather than the
      // eager one — either way it is off the initial download.
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'SyntenyTrack',
      viewType: 'LinearSyntenyView',
      ReactComponent: lazy(
        () => import('./components/LinearSyntenyRendering.tsx'),
      ),
    })
  })
}
