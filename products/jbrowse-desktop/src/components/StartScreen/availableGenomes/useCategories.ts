import { fetchJson, useFetch } from '@jbrowse/core/util'

const CATEGORIES_URL = 'https://jbrowse.org/hubs/categories.json'

export default function useCategories() {
  const { data, error, isLoading } = useFetch(CATEGORIES_URL, () =>
    fetchJson(CATEGORIES_URL),
  )

  return {
    categories: data as
      { categories: { key: string; title: string; url: string }[] } | undefined,
    isLoading,
    error,
  }
}
