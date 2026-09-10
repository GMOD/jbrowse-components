// What has to be true of a release before anyone publishes it, decided against
// the asset list and the manifests rather than against whether three CI jobs
// went green.
//
// The failure this is for produces no symptom until much later and then hits
// everybody: a release carrying six of the seven desktop assets is a release
// where one platform's `latest*.yml` is a 404, and electron-updater answers a
// 404 by throwing into an error handler that stays quiet for the startup check.
// That platform simply stops updating, and the next release does not fix it —
// it is the *new* release the old clients cannot see.
//
// Its own module, taking the asset list as data, for the reason artifacts.ts
// gives about config.ts and `import.meta.dirname`.
import type { UpdateFeedFile } from './updateFeed.ts'

export interface ReleaseAsset {
  name: string
  size: number
}

/**
 * The `files:` entries of one manifest, as electron-updater reads it back.
 *
 * Deliberately a re-parse rather than a round trip through the object
 * latestYml() was handed: what is being checked is the text on the release, so
 * anything the generator could get wrong has to survive being read again.
 */
export function parseUpdateFeed(yml: string): UpdateFeedFile[] {
  const files: UpdateFeedFile[] = []
  const unquote = (value: string) => value.replace(/^['"]|['"]$/g, '').trim()
  for (const line of yml.split('\n')) {
    const url = /^\s*-\s*url:\s*(.+)$/.exec(line)
    if (url) {
      files.push({ name: unquote(url[1]!), sha512: '', size: Number.NaN })
      continue
    }
    const current = files.at(-1)
    if (!current) {
      continue
    }
    const sha512 = /^\s+sha512:\s*(.+)$/.exec(line)
    if (sha512) {
      current.sha512 = unquote(sha512[1]!)
    }
    const size = /^\s+size:\s*(\d+)\s*$/.exec(line)
    if (size) {
      current.size = Number(size[1])
    }
  }
  return files
}

/**
 * Everything wrong with a release, as sentences. Empty means it can ship.
 *
 * Two questions, because they fail separately. Is every artifact the packagers
 * were supposed to produce actually on the release — which catches an upload
 * that never ran. And does each manifest describe the assets that are there —
 * which catches a manifest uploaded beside a *different* build of the artifact
 * it names, where every name matches and the bytes do not. A client checks the
 * hash and refuses the download; here the size disagreeing is the same fact,
 * available without fetching 500MB.
 */
export function auditRelease({
  expected,
  assets,
  manifests,
}: {
  expected: string[]
  assets: ReleaseAsset[]
  manifests: { name: string; files: UpdateFeedFile[] }[]
}) {
  const problems: string[] = []
  const byName = new Map(assets.map(asset => [asset.name, asset]))

  for (const name of expected) {
    if (!byName.has(name)) {
      problems.push(`${name} is not on the release`)
    }
  }

  for (const manifest of manifests) {
    if (manifest.files.length === 0) {
      problems.push(`${manifest.name} lists no files, so it updates nobody`)
    }
    for (const file of manifest.files) {
      const asset = byName.get(file.name)
      if (!asset) {
        problems.push(`${manifest.name} names ${file.name}, which is not there`)
      } else if (asset.size !== file.size) {
        problems.push(
          `${manifest.name} says ${file.name} is ${file.size} bytes; the release has ${asset.size}`,
        )
      }
    }
  }

  return problems
}
