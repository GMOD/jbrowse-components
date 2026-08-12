import { useRef, useState } from 'react'

import { useFetch } from '@jbrowse/core/util/useFetch'

import {
  readGlobalPlugins,
  setGlobalPlugins,
  withDisabled,
} from './globalPlugins.ts'

import type { GlobalPluginEntry } from './globalPlugins.ts'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

/**
 * The global plugin list, editable.
 *
 * `plugins` stays undefined until the list has actually been read, and every
 * edit is computed from it — an edit made against a list that failed to load
 * would write a truncated one back and silently drop every plugin the user had.
 */
export function useGlobalPluginsState() {
  const {
    data,
    error: loadError,
    mutate,
  } = useFetch('globalPlugins', () => readGlobalPlugins())
  // The list this dialog has edited, once it has; before that, the fetched one.
  // Set when an edit is *issued* rather than when it lands, so what is on screen
  // is always what the next edit composes onto. Waiting for the write meant two
  // clicks in a row both composed onto the list from before the first — the
  // second install overwrote the first, and a `remove` resolved a position
  // against a list one edit stale and deleted the wrong plugin.
  const [edited, setEdited] = useState<GlobalPluginEntry[]>()
  const [saveError, setSaveError] = useState<unknown>()
  const plugins = edited ?? data
  // Writes are chained for the same reason they are optimistic: two writeFile
  // calls in flight over one path have no defined winner, so the newer list
  // could land first and be overwritten by the older one.
  const writeRef = useRef<Promise<void>>(undefined)

  // never rejects: a write that failed is reported through saveError, and the
  // list goes back to whatever is actually on disk
  function save(next: GlobalPluginEntry[]) {
    setEdited(next)
    setSaveError(undefined)
    writeRef.current = (writeRef.current ?? Promise.resolve())
      .then(() => setGlobalPlugins(next))
      .catch((e: unknown) => {
        setSaveError(e)
        // what is on screen was never written, and nothing here knows what did
        // land (an earlier edit in the chain may have), so re-read rather than
        // guess
        setEdited(undefined)
        mutate()
      })
  }

  function edit(update: (prev: GlobalPluginEntry[]) => GlobalPluginEntry[]) {
    if (plugins) {
      save(update(plugins))
    }
  }

  return {
    plugins,
    loadError,
    saveError,
    add: (definition: PluginDefinition) => {
      edit(prev => [...prev, definition])
    },
    remove: (index: number) => {
      edit(prev => prev.filter((_, i) => i !== index))
    },
    // Switching one off keeps its entry, which is the difference from remove:
    // the user gets it back — same url, same pinned version, same integrity
    // hash — without going to find it in the store again. That is what makes
    // bisecting a list of four to find the one that crashes practical.
    setDisabled: (index: number, disabled: boolean) => {
      edit(prev =>
        prev.map((p, i) => (i === index ? withDisabled(p, disabled) : p)),
      )
    },
    // Unguarded, unlike the two above: this is also the way out of a
    // globalPlugins.json that cannot be read at all, where there is no list to
    // compose onto and overwriting it is the point.
    removeAll: () => {
      save([])
    },
  }
}
