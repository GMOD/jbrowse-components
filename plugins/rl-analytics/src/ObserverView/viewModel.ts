import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'

const defaultHeight = 200

export interface LogEntry {
  id: number
  text: string
}

/**
 * #stateModel RLObserverView
 * #category view
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function stateModelFactory(_pluginManager: PluginManager) {
  let nextEntryId = 0
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
      // MobX observable array for reactivity without O(n) copy.
      // Entries have stable monotonic IDs so React keys are stable
      // across eviction (avoids re-associating all rows when trimming).
      logEntries: observable.array<LogEntry>([], { deep: false }),
    }))
    .views(self => ({
      /**
       * #getter
       */
      menuItems(): MenuItem[] {
        return [
          {
            label: 'Clear log',
            onClick: () => {
              self.logEntries.clear()
            },
          },
        ]
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
      addLogEntry(text: string) {
        self.logEntries.push({ id: nextEntryId++, text })
        if (self.logEntries.length > self.maxLogEntries) {
          self.logEntries.splice(
            0,
            self.logEntries.length - self.maxLogEntries,
          )
        }
      },
      /**
       * #action
       */
      clearLog() {
        self.logEntries.clear()
      },
    }))
}

export type RLObserverViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
