import { fetchJson } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'

const CATEGORIES_URL = 'https://jbrowse.org/hubs/categories.json'

export interface Category {
  key: string
  title: string
  url: string
}

export default function useCategories() {
  const { data, error, isLoading } = useFetch(CATEGORIES_URL, () =>
    fetchJson<{ categories: Category[] }>(CATEGORIES_URL),
  )

  return { categories: data?.categories, isLoading, error }
}
