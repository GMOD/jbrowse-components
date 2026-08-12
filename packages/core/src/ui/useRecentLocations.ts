import { useLocalStorage } from '../util/hooks.ts'
import { instanceScopedKey } from './useAssemblySelection.ts'

// keep the list short so it reads as "jump back to somewhere recent" rather
// than a full history
const MAX_RECENT_LOCATIONS = 6

/**
 * A recorded row: what the menu shows, and what reopening it actually opens.
 *
 * The two are not the same string. A text-search hit's display string is built
 * for reading — a snippet ellipsized to fit, or `name (matched attribute)` when
 * the query hit something other than the name — and feeding it back to the
 * search finds nothing, because those characters were never in the index. So a
 * row that had a location carries it, and reopening parses that instead.
 *
 * `loc` is absent for a query the user typed and submitted freehand, which has
 * no resolved location to record. That label _is_ searchable (it is what the
 * user typed), so those rows are replayed through search as before.
 */
export interface RecentLocation {
  label: string
  loc?: string
}

// Rows written before locations were recorded are bare strings. They were
// display strings, so the ones that need `loc` are exactly the ones that never
// had it — read them as label-only and let them replay through search.
type StoredRecentLocation = RecentLocation | string

function normalize(entry: StoredRecentLocation): RecentLocation {
  return typeof entry === 'string' ? { label: entry } : entry
}

// the same place reached two ways (by name, then by ID) is one row, so rows
// that resolved to a location are identified by it rather than by their label
function identity({ label, loc }: RecentLocation) {
  return loc ?? label
}

/**
 * Remembers the locations recently opened from the header search box or an
 * import form, most-recent first and deduplicated, scoped per assembly (and per
 * host/path/config like the remembered assembly). Without an assembly there is
 * nothing to scope the key to, so the list stays in memory only.
 */
export function useRecentLocations(assemblyName?: string) {
  const [stored, setRecentLocations] = useLocalStorage<StoredRecentLocation[]>(
    instanceScopedKey('recentLocations', assemblyName ?? ''),
    [],
    Boolean(assemblyName),
  )
  const recentLocations = stored.map(normalize)
  function addRecentLocation(entry: RecentLocation) {
    const id = identity(entry)
    setRecentLocations(prev =>
      [entry, ...prev.map(normalize).filter(e => identity(e) !== id)].slice(
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
