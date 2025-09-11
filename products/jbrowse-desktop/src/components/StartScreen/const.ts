import useSWR from 'swr'

import { fetchjson } from './util'

import type { Fav } from './types'

export function useDefaultFavs() {
  const { data, error, isLoading } = useSWR(
    'defaultFavs',
    () => fetchjson('https://jbrowse.org/hubs/defaultFavs.json') as Promise<Fav[]>,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  return {
    defaultFavs: data,
    error,
    isLoading,
  }
}
