import { useLocalStorage } from '@jbrowse/core/util/hooks'

import defaultFavs from './defaultFavs.ts'

import type { Fav } from './types.ts'

export function useFavoriteGenomes() {
  return useLocalStorage<Fav[]>('startScreen-favEntries', defaultFavs)
}
