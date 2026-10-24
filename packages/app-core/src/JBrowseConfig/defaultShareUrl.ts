// The JBrowse-hosted session-sharing backend. Single source of truth for both
// the write path (the root config's `shareURL` default, read via getConf) and
// the read path (resolveShareUrl, which reads the raw config snapshot before
// config is initialized), so the two can't drift onto different endpoints.
export const DEFAULT_SHARE_URL = 'https://share.jbrowse.org/api/v1/'

/**
 * The share service a raw config snapshot names, absolute. JBrowse Web reads
 * an empty or relative `shareURL` as relative to its own page, so `pageUrl` is
 * the JBrowse Web page the link opens, whichever app is asking. A non-string
 * slot gets the default, as the schema would give it.
 */
export function resolveShareUrl(config: unknown, pageUrl: string) {
  const configured = (
    config as { configuration?: { shareURL?: unknown } } | undefined
  )?.configuration?.shareURL
  const shareURL =
    typeof configured === 'string' ? configured : DEFAULT_SHARE_URL
  try {
    // `./` for the empty string: `shareEndpoint` appends to the result, and
    // resolving `''` would keep the page's last segment (`…/index.html/share`)
    return new URL(shareURL || './', pageUrl).href
  } catch (e) {
    console.error(e)
    return shareURL
  }
}
