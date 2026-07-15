import { fetchJson, useFetch } from '@jbrowse/core/util'

const TAXONOMY_FILTER_URL = 'https://genomes.jbrowse.org/taxonomyFilter.json'

export default function useTaxonomyClades() {
  const { data, error, isLoading } = useFetch(TAXONOMY_FILTER_URL, () =>
    fetchJson<Record<string, number[]>>(TAXONOMY_FILTER_URL),
  )

  const clades = data
    ? new Map(
        Object.entries(data).map(([clade, taxonIds]) => [
          clade,
          new Set(taxonIds),
        ]),
      )
    : undefined

  return { clades, isLoading, error }
}
