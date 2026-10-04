import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import ScoreAxisHeading from './ScoreAxisHeading.tsx'
import { SCORE_AXIS_WIDGET } from './constants.ts'
import { stateModelFactory } from './stateModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #api
 * Registers the drawer widget the quantitative tracks' "Y axis..." row opens.
 * The wiggle plugin calls it once; alignments and the mark display open it by
 * name.
 */
export function registerScoreAxisWidget(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: SCORE_AXIS_WIDGET,
        discardOnClose: true,
        HeadingComponent: ScoreAxisHeading,
        configSchema: ConfigurationSchema(SCORE_AXIS_WIDGET, {}),
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazyWithPreload(() => import('./ScoreAxisWidget.tsx')),
      }),
  )
}
