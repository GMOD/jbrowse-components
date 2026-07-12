import { fetchJson, useFetch } from '@jbrowse/core/util'

const CATEGORIES_URL = 'https://jbrowse.org/hubs/categories.json'

export interface Category {
  key: string
  title: string
  url: string
}

export interface Categories {
  categories: Category[]
}

export default function useCategories() {
  const { data, error, isLoading } = useFetch<Categories>(CATEGORIES_URL, () =>
    fetchJson<Categories>(CATEGORIES_URL),
  )

  return {
    categories: data,
    isLoading,
    error,
  }
}
