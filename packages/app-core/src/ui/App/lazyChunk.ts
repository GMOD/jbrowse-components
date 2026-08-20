/**
 * Wraps a dynamic import so a failed chunk fetch says what actually happened.
 *
 * Webpack flattens every network-level failure into the same string —
 * `Loading chunk X failed.\n(error: <url>)` — where `error` only means the
 * script element fired `error` rather than `load` (a 404, a refused
 * connection and a dropped socket are indistinguishable). That string is what
 * jbrowse-web records via `markCrashedSession`, so it is also all a later boot
 * can show. The immediate refetch below is the part that discriminates:
 * webpack clears its `installedChunks` entry on failure, so the asset is
 * really re-requested, and a 200 here means the asset was always fine and the
 * one request was not.
 */
async function probeChunk(url: string) {
  try {
    const response = await fetch(url, { cache: 'reload' })
    const body = await response.text()
    return `refetch: HTTP ${response.status} ${response.statusText}, ${response.headers.get('content-type')}, ${body.length} bytes`
  } catch (e) {
    return `refetch also failed: ${e}`
  }
}

/**
 * What the browser recorded for the request that failed — the status it
 * actually saw and whether any bytes crossed the network. A `transferSize` of
 * 0 alongside a body size says the response came from the cache rather than
 * the server, which is the one thing `curl` can never show.
 */
function resourceTiming(url: string) {
  const entry = performance
    .getEntriesByName(url)
    .find(e => e instanceof PerformanceResourceTiming)
  return entry
    ? {
        responseStatus: entry.responseStatus,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        duration: Math.round(entry.duration),
      }
    : 'no resource timing entry'
}

/**
 * The two fields webpack hangs off a ChunkLoadError: the URL it asked for, and
 * whether the script element reported `error` (the request failed), `missing`
 * (it loaded but registered nothing) or `timeout`.
 */
function chunkErrorDetail(error: unknown) {
  return error instanceof Error &&
    error.name === 'ChunkLoadError' &&
    'request' in error &&
    typeof error.request === 'string'
    ? {
        url: error.request,
        type: 'type' in error ? String(error.type) : 'unknown',
      }
    : undefined
}

/**
 * A dynamic import that survives one bad response for its chunk.
 *
 * The retry is not a hopeful second roll: `probeChunk` refetches with
 * `cache: 'reload'`, which both reports what the server really says and
 * replaces whatever the HTTP cache was holding, and webpack clears its
 * `installedChunks` entry on failure — so the second `import()` is a real
 * request against a repaired cache entry. React.lazy cannot do this itself: it
 * stores the rejection and rethrows it for the life of the page without ever
 * calling the factory again, so the recovery has to happen here, before the
 * promise settles.
 */
export function lazyChunk<T>(name: string, load: () => Promise<T>) {
  return () =>
    load().catch(async (error: unknown) => {
      const detail = chunkErrorDetail(error)
      if (detail) {
        console.error(
          `chunk load failed: ${name}`,
          JSON.stringify(
            {
              ...detail,
              online: navigator.onLine,
              at: new Date().toISOString(),
              timing: resourceTiming(detail.url),
              probe: await probeChunk(detail.url),
            },
            undefined,
            2,
          ),
        )
        const retried = await load().catch((retryError: unknown) => {
          console.error(`chunk retry failed: ${name}`, retryError)
          throw error
        })
        console.error(`chunk retry succeeded: ${name}`)
        return retried
      }
      throw error
    })
}
