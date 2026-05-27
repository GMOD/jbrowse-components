import { getGraphicsCapabilities } from './getGraphicsCapabilities.ts'
import { useFetch } from '../util/useFetch.ts'

export function useGraphicsCapabilities() {
  const { data } = useFetch(['graphicsCapabilities'], () =>
    getGraphicsCapabilities(),
  )
  return data ?? null
}
