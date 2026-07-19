import { instanceScopedKey } from './useAssemblySelection.ts'
import { useLocalStorage } from '../util/index.ts'


// keep the list short so it reads as "jump back to somewhere recent" rather
// than a full history
const MAX_RECENT_LOCATIONS = 6

/**
 * Remembers the locations recently opened from an import form, most-recent
 * first and deduplicated, scoped per assembly (and per host/path/config like
 * the remembered assembly). Disabled under jest so tests don't touch
 * localStorage; the in-memory list still updates, so the behavior stays
 * testable.
 */
export function useRecentLocations(assemblyName?: string) {
  const [recentLocations, setRecentLocations] = useLocalStorage<string[]>(
    instanceScopedKey('recentLocations', assemblyName ?? ''),
    [],
    typeof jest === 'undefined' && Boolean(assemblyName),
  )
  function addRecentLocation(loc: string) {
    setRecentLocations(prev =>
      [loc, ...prev.filter(entry => entry !== loc)].slice(
        0,
        MAX_RECENT_LOCATIONS,
      ),
    )
  }
  function clearRecentLocations() {
    setRecentLocations([])
  }
  return { recentLocations, addRecentLocation, clearRecentLocations }
}
