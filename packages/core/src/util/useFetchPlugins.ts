import { fetchPlugins } from '../checkPlugins.ts'
import { useFetch } from './useFetch.ts'

/**
 * The plugin store listing. Shared by every surface that installs plugins (the
 * in-session plugin store widget, Desktop's global plugins dialog) so they read
 * the same manifest version and get the same integrity hashes and compatibility
 * ranges — a second copy of this fetch is how one of them silently ends up on
 * the unhashed v1 list.
 *
 * Through `fetchPlugins`, which memoizes its request, rather than fetching the
 * url directly: `useFetch` holds no data cache, so every open of the store
 * widget was a fresh round trip beside whatever the boot path had already
 * asked for.
 */
export function useFetchPlugins() {
  const { data, error } = useFetch('jbrowse-plugin-store-v2', fetchPlugins)
  return { plugins: data?.plugins, error }
}
