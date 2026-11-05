import { DEFAULT_SHARE_URL } from '@jbrowse/core/util/types'

export { DEFAULT_SHARE_URL }

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
