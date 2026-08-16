import { useState } from 'react'

import { locationId } from './pairLocations.ts'
import { parseUrlList } from './util.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

export type InputMode = 'remote' | 'local'

/**
 * Owns the bulk-input state (mode plus remote-URL text or dropped local files)
 * and exposes the resolved, deduped location list as a single source of truth.
 * Removal rewrites the underlying input rather than tracking a separate
 * "removed" overlay, so the input always reflects what will be added.
 */
export function useBulkLocations() {
  const [mode, setMode] = useState<InputMode>('remote')
  const [text, setText] = useState('')
  const [localLocations, setLocalLocations] = useState<FileLocation[]>([])

  // Dedupe by location id so a URL pasted twice — or the same file dropped
  // twice — collapses to one row rather than adding the track twice.
  const raw = mode === 'remote' ? parseUrlList(text) : localLocations
  const locations = [
    ...new Map(raw.map(loc => [locationId(loc), loc])).values(),
  ]

  // Rewrites the input itself, functionally: removal is the one edit that
  // arrives from a row rather than from the field, so reading the list captured
  // at render would drop a second removal batched into the same tick.
  function removeLocations(ids: Set<string>) {
    if (mode === 'remote') {
      setText(prev =>
        parseUrlList(prev)
          .map(locationId)
          .filter(id => !ids.has(id))
          .join('\n'),
      )
    } else {
      setLocalLocations(prev => prev.filter(loc => !ids.has(locationId(loc))))
    }
  }

  return {
    mode,
    setMode,
    text,
    setText,
    localLocations,
    setLocalLocations,
    locations,
    removeLocations,
  }
}

export type BulkLocationsState = ReturnType<typeof useBulkLocations>
