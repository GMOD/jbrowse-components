import { locationId } from './pairLocations.ts'
import { parseUrlList } from './util.ts'

import type { AddTrackModel, BulkInputMode } from '../AddTrackWidget/model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

export type InputMode = BulkInputMode

/**
 * The bulk input (mode plus remote-URL text or dropped local files) as the
 * resolved, deduped location list, with the edits the form makes to it.
 *
 * Reads and writes the widget model rather than component state, so the list
 * survives the drawer unmounting the workflow — see `BulkInputState`. Removal
 * rewrites the underlying input rather than tracking a separate "removed"
 * overlay, so the input always reflects what will be added.
 */
export function bulkLocations(model: AddTrackModel) {
  const { mode, text, localLocations } = model.bulk

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
      model.updateBulkInput({ mode: arg })
    },
    setText(arg: string) {
      model.updateBulkInput({ text: arg })
    },
    addLocalLocations(arg: FileLocation[]) {
      model.updateBulkInput({
        localLocations: [...model.bulk.localLocations, ...arg],
      })
    },
    clearLocalLocations() {
      model.updateBulkInput({ localLocations: [] })
    },

    // Rewrites the input itself, reading the model rather than the list
    // captured at render, so a second removal in the same tick can't drop the
    // first.
    removeLocations(ids: Set<string>) {
      const bulk = model.bulk
      if (bulk.mode === 'remote') {
        model.updateBulkInput({
          text: parseUrlList(bulk.text)
            .map(locationId)
            .filter(id => !ids.has(id))
            .join('\n'),
        })
      } else {
        model.updateBulkInput({
          localLocations: bulk.localLocations.filter(
            loc => !ids.has(locationId(loc)),
          ),
        })
      }
    },
  }
}

export type BulkLocationsState = ReturnType<typeof bulkLocations>
