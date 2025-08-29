import { useMemo } from 'react'

import type { Fav } from '../types'

export function useFavorites(favorites: Fav[], setFavorites: (favs: Fav[]) => void) {
  const favs = useMemo(() => new Set(favorites.map(r => r.id)), [favorites])

  const toggleFavorite = (row: any) => {
    const isFavorite = favs.has(row.id)
    if (isFavorite) {
      setFavorites(favorites.filter(fav => fav.id !== row.id))
    } else {
      setFavorites([
        ...favorites,
        {
          id: row.id,
          shortName: row.name || row.ncbiAssemblyName || row.accession,
          description: row.description || row.commonName,
          jbrowseConfig: row.jbrowseConfig,
        },
      ])
    }
  }

  return { favs, toggleFavorite }
}
