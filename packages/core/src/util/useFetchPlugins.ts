import { fetchJson } from './index.ts'
import { useFetch } from './useFetch.ts'

import type { JBrowsePlugin } from './types/index.ts'

// v2 manifest adds per-version JBrowse compatibility ranges + integrity hashes;
// the v1 plugins.json remains served for older clients that predate this.
const PLUGIN_STORE_URL = 'https://jbrowse.org/plugin-store/v2/plugins.json'

/**
 * The plugin store listing. Shared by every surface that installs plugins (the
 * in-session plugin store widget, Desktop's global plugins dialog) so they read
 * the same manifest version and get the same integrity hashes and compatibility
 * ranges — a second copy of this fetch is how one of them silently ends up on
 * the unhashed v1 list.
 */
export function useFetchPlugins() {
  const { data, error } = useFetch('jbrowse-plugin-store-v2', () =>
    fetchJson<{ plugins: JBrowsePlugin[] }>(PLUGIN_STORE_URL),
  )
  return { plugins: data?.plugins, error }
}
