import { types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

/**
 * #stateModel PluginsUpdatedMixin
 * The root's "the plugin set changed" flag. It latches: a plugin set only
 * changes by rebuilding the plugin manager, which replaces this root.
 */
export function PluginsUpdatedMixin() {
  return types
    .model({})
    .volatile(() => ({
      /**
       * #volatile
       */
      pluginsUpdated: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setPluginsUpdated() {
        self.pluginsUpdated = true
      },
    }))
}

/**
 * Runs `effect` once, a microtask after the flag first latches. An update is a
 * remove and an add in two actions, and answering the first would rebuild from
 * a list that holds neither version.
 */
export function onPluginsUpdated(
  self: { pluginsUpdated: boolean },
  effect: () => void,
) {
  return reaction(
    () => self.pluginsUpdated,
    updated => {
      if (updated) {
        effect()
      }
    },
    {
      scheduler: run => {
        queueMicrotask(run)
      },
      name: 'PluginsUpdated',
    },
  )
}
