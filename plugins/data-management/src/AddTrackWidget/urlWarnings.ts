// Pure URL predicates shared by the single-track and bulk add-track workflows
// so both surface the same "this URL probably won't load" guidance.

/** A URL with no scheme and no leading slash, e.g. `data/foo.bam`. */
export function isRelativeUrl(url = '') {
  try {
    new URL(url)
    return false
  } catch {
    return !url.startsWith('/')
  }
}

export function isFtpUrl(url = '') {
  return url.startsWith('ftp://')
}

/** An http resource the browser will block because the page itself is https. */
export function isBlockedHttpUrl(url = '') {
  return window.location.protocol === 'https:' && url.startsWith('http://')
}
