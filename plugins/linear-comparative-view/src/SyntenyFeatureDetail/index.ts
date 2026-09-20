import { lazy } from 'react'

import { stateModelFactory as BaseFeatureWidgetStateModelF } from '@jbrowse/core/BaseFeatureWidget'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import { isSyntenyLevel } from '../LinearSyntenyViewHelper/parentViewDuck.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('SyntenyFeatureWidget', {})

function stateModelF(pluginManager: PluginManager) {
  return types
    .compose(
      BaseFeatureWidgetStateModelF(pluginManager),
      types.model('SyntenyFeatureWidget', {
        /**
         * #property
         */
        type: types.literal('SyntenyFeatureWidget'),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * The band the feature was clicked in, read off the widget's own track so
       * it follows the band when rows are added or removed. Undefined for a
       * synteny track open in a plain linear genome view.
       */
      get level(): number | undefined {
        const { track } = self
        const container: unknown = track ? getParent(track, 2) : undefined
        return isSyntenyLevel(container) ? container.level : undefined
      },
    }))
}

export default function SyntenyFeatureWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'SyntenyFeatureWidget',
        heading: 'Synteny feature details',
        configSchema,
        stateModel: stateModelF(pluginManager),
        ReactComponent: lazy(() => import('./SyntenyFeatureDetail.tsx')),
      }),
  )
}
