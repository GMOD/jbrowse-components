// The two YAML files electron-updater reads: `app-update.yml`, baked into the
// app so it knows where to look, and `latest*.yml`, published beside the
// artifacts so it knows what is there.
//
// Its own module, taking every value as a parameter, for the reason artifacts.ts
// and nsisScript.ts give: config.ts reads `import.meta.dirname`, so anything
// importing it is untestable under jest's CJS transform. That matters here
// because nothing else parses these files until a user's app polls for an
// update — a malformed or short manifest is answered with silence, not an error.

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
 * `publisherName` is what turns on NsisUpdater's Authenticode check of the
 * installer it just downloaded: with the field absent `verifySignature` returns
 * null and the check is skipped entirely. It has to be the exact CN of the
 * signing certificate — a wrong one refuses every update — so it is threaded
 * through from an environment variable rather than guessed, and its absence
 * leaves the pre-existing behaviour.
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
