import { useLocalStorage } from '@jbrowse/core/util/hooks'

/**
 * Which recent sessions the user has starred, keyed by session path.
 *
 * Owns the localStorage key and the pruning that keeps it honest, so the panel
 * only asks the two questions it has (is this one starred, toggle it) and hands
 * over each fresh session list.
 */
export function useFavoriteSessions() {
  const [favorites, setFavorites] = useLocalStorage(
    'startScreen-favoriteSessions',
    [] as string[],
  )
  const favs = new Set(favorites)

  return {
    isFavorite: (sessionPath: string) => favs.has(sessionPath),

    toggleFavorite: (sessionPath: string) => {
      setFavorites(
        favs.has(sessionPath)
          ? favorites.filter(path => path !== sessionPath)
          : [...favorites, sessionPath],
      )
    },

    /**
     * Drop stars for sessions the list no longer has. Nothing else prunes them:
     * a deleted session kept its star forever, and a later session saved to the
     * same path (Documents/JBrowse/untitled.jbrowse is easy to reuse) came back
     * starred on its own.
     *
     * Not done for an empty list, which is also what an unreadable
     * recent_sessions.json reads as — that must not cost the user every star
     * they have. Call it with a list that was actually read, not a default.
     */
    pruneTo: (rows: { path: string }[]) => {
      if (rows.length) {
        const live = new Set(rows.map(r => r.path))
        const next = favorites.filter(path => live.has(path))
        if (next.length !== favorites.length) {
          setFavorites(next)
        }
      }
    },
  }
}
