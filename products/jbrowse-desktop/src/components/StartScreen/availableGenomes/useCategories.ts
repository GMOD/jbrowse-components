import useSWR from 'swr'

import { fetchjson } from '../util'

export default function useCategories() {
  const { data, error, isLoading } = useSWR('categories', () =>
    fetchjson('https://jbrowse.org/hubs/categories.json'),
  )

  return {
    categories: data as
      | { categories: { key: string; title: string; url: string }[] }
      | undefined,
    isLoading,
    error,
  }
}
