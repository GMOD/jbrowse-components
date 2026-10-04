import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel ScoreAxisWidget
 * Drawer widget editing one display's value scale, `scales.y`. The display is
 * a safe reference, so hiding its track or closing its view empties it rather
 * than leaving the widget writing to a dead node.
 */
export function stateModelFactory(pluginManager: PluginManager) {
  return types.model('ScoreAxisWidget', {
    /**
     * #property
     */
    id: ElementId,
    /**
     * #property
     */
    type: types.literal('ScoreAxisWidget'),
    /**
     * #property
     */
    display: types.safeReference(
      pluginManager.pluggableMstType('display', 'stateModel'),
    ),
    /**
     * #property
     * The name of the menu row that opened it, "Y axis" or "Coverage axis",
     * so the heading says the same.
     */
    label: types.optional(types.string, 'Y axis'),
  })
}

export interface ScoreAxisWidgetModel extends Instance<
  ReturnType<typeof stateModelFactory>
> {}
