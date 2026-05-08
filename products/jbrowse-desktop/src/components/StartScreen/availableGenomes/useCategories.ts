import { useFetch } from '@jbrowse/core/util'

import { fetchJson as fetchjson } from '@jbrowse/core/util'

export default function useCategories() {
  const { data, error, isLoading } = useFetch('categories', () =>
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
