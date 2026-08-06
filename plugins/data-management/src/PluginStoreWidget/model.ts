import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel PluginStoreWidget
 * Widget backing the plugin store: holds the text and tag filters applied to the
 * installable plugin list and the view it was opened from.
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('PluginStoreModel', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('PluginStoreWidget'),
      /**
       * #property
       */
      filterText: '',
      /**
       * #property
       * Tags a plugin must carry to stay in the list. Plain strings, because the
       * tag vocabulary is published in the store manifest rather than defined
       * here — a tag this build has never seen still filters correctly.
       */
      tagFilters: types.optional(types.array(types.string), []),
      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .views(self => ({
      /**
       * #getter
       */
      get selectedTags() {
        return new Set<string>(self.tagFilters)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFilterText(newText: string) {
        self.filterText = newText
      },
      /**
       * #action
       */
      toggleTagFilter(tag: string) {
        const idx = self.tagFilters.indexOf(tag)
        if (idx === -1) {
          self.tagFilters.push(tag)
        } else {
          self.tagFilters.splice(idx, 1)
        }
      },
      /**
       * #action
       */
      clearTagFilters() {
        self.tagFilters.clear()
      },
    }))
}

export type PluginStoreStateModel = ReturnType<typeof stateModelFactory>
export type PluginStoreModel = Instance<PluginStoreStateModel>
