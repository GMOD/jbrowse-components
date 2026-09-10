// The two YAML files electron-updater reads: `app-update.yml`, baked into the
// app so it knows where to look, and `latest*.yml`, published beside the
// artifacts so it knows what is there. Parameterized, and so testable, for the
// reason artifacts.ts and nsisScript.ts give — which matters more here, since
// nothing else parses these until a user's app polls and gets silence.

export interface UpdateFeedFile {
  /** the artifact's basename, which is also its url relative to the release */
  name: string
  /** base64 sha512 — electron-updater's format, not a preference */
  sha512: string
  size: number
}

/**
 * The feed for one platform: the artifacts a client may download, and the hash
 * it checks each against.
 *
 * `files[0]` is repeated into the pre-`files` `path`/`sha512` fields that older
 * clients read, so each caller passes the artifact its platform updates FROM
 * first — mac's zip, not its dmg.
 */
export function latestYml({
  version,
  files,
}: {
  version: string
  files: UpdateFeedFile[]
}) {
  const first = files[0]
  if (!first) {
    throw new Error('an update manifest listing no files updates nobody')
  }
  return [
    `version: '${version}'`,
    'files:',
    ...files.flatMap(file => [
      `  - url: '${file.name}'`,
      `    sha512: '${file.sha512}'`,
      `    size: ${file.size}`,
    ]),
    `path: '${first.name}'`,
    `sha512: '${first.sha512}'`,
    `releaseDate: '${new Date().toISOString()}'`,
  ].join('\n')
}

/**
 * The copy that ships inside the app, at `resources/app-update.yml`.
 *
 * `publisherName` turns on NsisUpdater's Authenticode check of the installer it
 * downloaded; without it `verifySignature` returns null and skips the check.
 */
export function appUpdateYml({
  owner,
  repo,
  cacheDirName,
  publisherName,
}: {
  owner: string
  repo: string
  cacheDirName: string
  publisherName?: string
}) {
  return [
    'provider: github',
    `owner: ${owner}`,
    `repo: ${repo}`,
    `updaterCacheDirName: ${cacheDirName}`,
    ...(publisherName ? [`publisherName: '${publisherName}'`] : []),
    '',
  ].join('\n')
}
