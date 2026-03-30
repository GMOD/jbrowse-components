import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

const defaultHeight = 200

export default function stateModelFactory() {
  return types
    .compose(
      BaseViewModel,
      types.model('RLObserverView', {
        type: types.literal('RLObserverView'),
        height: types.optional(types.number, defaultHeight),
        maxLogEntries: types.optional(types.number, 200),
      }),
    )
    .volatile(() => ({
      logEntries: [] as string[],
    }))
    .actions(self => ({
      setHeight(height: number) {
        self.height = Math.max(60, height)
      },
      addLogEntry(entry: string) {
        self.logEntries.push(entry)
        if (self.logEntries.length > self.maxLogEntries) {
          self.logEntries = self.logEntries.slice(-self.maxLogEntries)
        }
      },
      clearLog() {
        self.logEntries = []
      },
    }))
}

export type RLObserverViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
