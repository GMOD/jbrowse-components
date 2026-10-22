import { bulkInput } from './bulkInput.ts'
import { locationId } from './pairLocations.ts'
import { parseUrlList } from './util.ts'

import type { InputMode } from './bulkInput.ts'
import type { AddTrackWorkflowModel } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'

/**
 * The bulk input (mode plus remote-URL text or dropped local files) as the
 * resolved, deduped location list, with the edits the form makes to it.
 *
 * Removal rewrites the underlying input rather than tracking a separate
 * "removed" overlay, so the input always reflects what will be added.
 */
export function bulkLocations(model: AddTrackWorkflowModel) {
  const input = bulkInput(model)
  const { mode, text, localLocations } = input.form

  // Dedupe by location id so a URL pasted twice — or the same file dropped
  // twice — collapses to one row rather than adding the track twice.
  const raw = mode === 'remote' ? parseUrlList(text) : localLocations
  const locations = [
    ...new Map(raw.map(loc => [locationId(loc), loc])).values(),
  ]

  return {
    mode,
    text,
    localLocations,
    locations,

    setMode(arg: InputMode) {
      input.update({ mode: arg })
    },
    setText(arg: string) {
      input.update({ text: arg })
    },
    addLocalLocations(arg: FileLocation[]) {
      input.update({
        localLocations: [...bulkInput(model).form.localLocations, ...arg],
      })
    },
    clearLocalLocations() {
      input.update({ localLocations: [] })
    },

    // Reads the model rather than the list captured at render, so a second
    // removal in the same tick can't drop the first.
    removeLocations(ids: Set<string>) {
      const current = bulkInput(model).form
      if (current.mode === 'remote') {
        input.update({
          text: parseUrlList(current.text)
            .map(locationId)
            .filter(id => !ids.has(id))
            .join('\n'),
        })
      } else {
        input.update({
          localLocations: current.localLocations.filter(
            loc => !ids.has(locationId(loc)),
          ),
        })
      }
    },
  }
}

export type BulkLocationsState = ReturnType<typeof bulkLocations>
