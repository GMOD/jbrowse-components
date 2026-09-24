import { instanceUrl } from './url.ts'

// the first release to publish `[data-app-phase]` and its census
const MIN_MAJOR = 5

/**
 * Refuse a JBrowse Web instance older than v5, read off its `version.txt`. An
 * instance that serves no version passes, and the session gate judges it.
 */
export async function assertSupportedInstance(instance: string) {
  const text = await fetch(new URL('version.txt', instanceUrl(instance)), {
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
