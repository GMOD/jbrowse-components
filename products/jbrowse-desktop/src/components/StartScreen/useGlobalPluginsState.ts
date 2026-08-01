import { useState } from 'react'

import { useFetch } from '@jbrowse/core/util/useFetch'

import { readGlobalPlugins, setGlobalPlugins } from './globalPlugins.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

/**
 * The global plugin list, editable.
 *
 * `plugins` stays undefined until the list has actually been read, and every
 * edit is computed from it — an edit made against a list that failed to load
 * would write a truncated one back and silently drop every plugin the user had.
 */
export function useGlobalPluginsState() {
  const { data, error: loadError } = useFetch('globalPlugins', () =>
    readGlobalPlugins(),
  )
  // the saved list, once an edit has been written; before that the fetched one
  const [saved, setSaved] = useState<PluginDefinition[]>()
  const [saveError, setSaveError] = useState<unknown>()
  const plugins = saved ?? data

  // never rejects: a write that failed is reported through saveError, and the
  // list on screen stays the one on disk
  function save(next: PluginDefinition[]) {
    setGlobalPlugins(next)
      .then(() => {
        setSaved(next)
        setSaveError(undefined)
      })
      .catch((e: unknown) => {
        setSaveError(e)
      })
  }

  return {
    plugins,
    loadError,
    saveError,
    add: (definition: PluginDefinition) => {
      if (plugins) {
        save([...plugins, definition])
      }
    },
    remove: (index: number) => {
      if (plugins) {
        save(plugins.filter((_, i) => i !== index))
      }
    },
    removeAll: () => {
      save([])
    },
  }
}
