// Star count for the header's "Star" button, fetched once at build time.
// Fail-soft on purpose: the GitHub API is rate-limited per IP (60/hr
// unauthenticated) and a docs build must not depend on it, so any failure just
// drops the count and leaves a plain "Star" button.
const REPO = 'GMOD/jbrowse-components'

// BaseLayout renders once per page, so this must be fetched once for the whole
// build, not once per page (that is hundreds of calls into a 60/hr budget).
let pending: Promise<number | undefined> | undefined

export function getStarCount() {
  pending ??= fetchStarCount()
  return pending
}

async function fetchStarCount() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const { stargazers_count: stars } = (await res.json()) as {
        stargazers_count: number
      }
      return typeof stars === 'number' ? stars : undefined
    }
    // 403 here is the rate limit; logging the status is what distinguishes it
    // from a network failure when the button builds without a count.
    console.warn(`star count unavailable: HTTP ${res.status}`)
  } catch (e) {
    console.warn(`star count unavailable: ${e}`)
  }
  return undefined
}

export function formatStars(stars: number) {
  return stars < 1000 ? String(stars) : `${(stars / 1000).toFixed(1)}k`
}
