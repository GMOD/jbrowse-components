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
        // Reassign to trigger MobX reactivity (volatile arrays don't
        // react to push)
        const entries = [...self.logEntries, entry]
        self.logEntries =
          entries.length > self.maxLogEntries
            ? entries.slice(-self.maxLogEntries)
            : entries
      },
      clearLog() {
        self.logEntries = []
      },
    }))
}

export type RLObserverViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
