import { useFetch } from '../util/useFetch.ts'
import { getGraphicsCapabilities } from './getGraphicsCapabilities.ts'

export function useGraphicsCapabilities() {
  const { data } = useFetch(['graphicsCapabilities'], () =>
    getGraphicsCapabilities(),
  )
  return data ?? null
}
