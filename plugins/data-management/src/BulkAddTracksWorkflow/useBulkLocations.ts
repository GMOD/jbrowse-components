import { useState } from 'react'

import { locationId } from './pairLocations.ts'
import { parseUrlList } from './util.ts'

import type { InputMode } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

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

  // Dedupe by location id so a URL pasted twice collapses to one row and the
  // orphan-index accounting stays accurate.
  const raw = mode === 'remote' ? parseUrlList(text) : localLocations
  const locations = [
    ...new Map(raw.map(loc => [locationId(loc), loc])).values(),
  ]

  function removeLocations(ids: Set<string>) {
    const kept = locations.filter(loc => !ids.has(locationId(loc)))
    if (mode === 'remote') {
      setText(kept.map(locationId).join('\n'))
    } else {
      setLocalLocations(kept)
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
