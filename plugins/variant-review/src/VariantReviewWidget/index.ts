import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('VariantReviewWidget', {})

export default function VariantReviewWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'VariantReviewWidget',
        // the drawer is a view onto the LGV's review state, so keep it about
        // for reopening rather than rebuilding it
        discardOnClose: false,
        heading: 'Variant review',
        configSchema,
        stateModel: stateModelFactory(),
        ReactComponent: lazyWithPreload(
          () => import('./components/VariantReviewWidget.tsx'),
        ),
      }),
  )
}
