import { readQueryParams, resolveShareUrl } from '@jbrowse/app-core'
import {
  SHARE_PREFIX,
  prefetchSharedSession as prefetch,
  shareEndpoint,
  sharedSessionUrl,
} from '@jbrowse/core/util/sessionParam'

import { prefetchedConfig } from './prefetchConfig.ts'

/**
 * Request a share link's session from the share service the config names as
 * soon as the config is in, instead of after the session loader has built the
 * config's plugins. The reader in `sessionSharing.ts` takes the response.
 */
export function prefetchSharedSession() {
  const config = prefetchedConfig()
  const { session, password } = readQueryParams(['session', 'password'])
  if (config && session?.startsWith(SHARE_PREFIX)) {
    config
      .then(async snapshot => {
        if (snapshot) {
          prefetch(
            await sharedSessionUrl(
              shareEndpoint(
                resolveShareUrl(snapshot, window.location.href),
                'load',
              ),
              session,
              password,
            ),
          )
        }
      })
      .catch(() => {})
  }
}
