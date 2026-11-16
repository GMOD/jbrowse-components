const FETCH_TIMEOUT_MS = 30000

export const HOSTED_HINT =
  'See https://genomes.jbrowse.org for the available assemblies.'

/**
 * Fetch JSON with a timeout, throwing a message that names `what` and the URL,
 * the budget only when it ran out, and `hint` after either failure. Uncached:
 * a capture batch fetches hg38's 1.5 MB config once per image (~0.3s), and a
 * module cache would leak between tests and serve a long-lived process a
 * stale config.
 */
export async function fetchJson(
  url: string,
  what: string,
  hint?: string,
): Promise<unknown> {
  const after = hint ? ` ${hint}` : ''
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new Error(
      `${what} could not be fetched from ${url} ` +
        `(${error instanceof Error ? error.message : error}${
          timedOut ? `, after ${FETCH_TIMEOUT_MS}ms` : ''
        }).${after}`,
      { cause: error },
    )
  })
  if (!res.ok) {
    throw new Error(
      `${what} not found (HTTP ${res.status} from ${url}).${after}`,
    )
  }
  return res.json()
}
