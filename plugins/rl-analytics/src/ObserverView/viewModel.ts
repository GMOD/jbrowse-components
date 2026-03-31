import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'

const defaultHeight = 200

/**
 * #stateModel RLObserverView
 * #category view
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function stateModelFactory(_pluginManager: PluginManager) {
  return types
    .compose(
      BaseViewModel,
      types.model('RLObserverView', {
        /**
         * #property
         */
        type: types.literal('RLObserverView'),
        /**
         * #property
         */
        height: types.optional(types.number, defaultHeight),
        /**
         * #property
         */
        maxLogEntries: types.optional(types.number, 200),
      }),
    )
    .volatile(() => ({
      logEntries: [] as string[],
    }))
    .views(() => ({
      /**
       * #getter
       */
      menuItems(): MenuItem[] {
        return []
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHeight(height: number) {
        self.height = Math.max(60, height)
      },
      /**
       * #action
       */
      addLogEntry(entry: string) {
        const entries = [...self.logEntries, entry]
        self.logEntries =
          entries.length > self.maxLogEntries
            ? entries.slice(-self.maxLogEntries)
            : entries
      },
      /**
       * #action
       */
      clearLog() {
        self.logEntries = []
      },
    }))
}

export type RLObserverViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
