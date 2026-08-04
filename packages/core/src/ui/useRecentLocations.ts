import { useLocalStorage } from '../util/hooks.ts'
import { instanceScopedKey } from './useAssemblySelection.ts'

// keep the list short so it reads as "jump back to somewhere recent" rather
// than a full history
const MAX_RECENT_LOCATIONS = 6

/**
 * Remembers the locations recently opened from an import form, most-recent
 * first and deduplicated, scoped per assembly (and per host/path/config like
 * the remembered assembly). Without an assembly there is nothing to scope the
 * key to, so the list stays in memory only.
 */
export function useRecentLocations(assemblyName?: string) {
  const [recentLocations, setRecentLocations] = useLocalStorage<string[]>(
    instanceScopedKey('recentLocations', assemblyName ?? ''),
    [],
    Boolean(assemblyName),
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
