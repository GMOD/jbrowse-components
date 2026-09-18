// v5 is the first release to publish `[data-app-phase]` and the census beside
// it, which are the only signals this package waits on.
const MIN_MAJOR = 5

/**
 * Refuse a JBrowse Web instance older than v5 before launching a browser at it.
 *
 * Every jbrowse-web build writes its version to `version.txt`. An instance that
 * serves none, or serves its index page there, cannot be judged and passes; the
 * session gate still fails on it, a timeout later.
 */
export async function assertSupportedInstance(instance: string) {
  const text = await fetch(new URL('version.txt', instance), {
    signal: AbortSignal.timeout(10000),
  })
    .then(res => (res.ok ? res.text() : ''))
    .catch(() => '')
  const version = text.trim()
  const major = /^(\d+)\.\d+\.\d+/.exec(version)?.[1]
  if (major !== undefined && Number(major) < MIN_MAJOR) {
    throw new Error(
      `${instance} serves JBrowse ${version}, and @jbrowse/capture needs v${MIN_MAJOR} or later: ` +
        'older builds publish no readiness marker to wait on. Point --instance at a ' +
        `v${MIN_MAJOR} build.`,
    )
  }
}
