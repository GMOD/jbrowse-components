// What has to be true of a release before anyone publishes it. A release
// missing one platform's `latest*.yml` is a 404 that platform's clients answer
// with silence, and the next release does not fix it — that is the release they
// can no longer see. Its own module for the reason artifacts.ts gives about
// config.ts and `import.meta.dirname`.
import type { UpdateFeedFile } from './updateFeed.ts'

export interface ReleaseAsset {
  name: string
  size: number
}

/**
 * The `files:` entries of one manifest, re-parsed rather than round-tripped
 * through what latestYml() was handed: the text on the release is what a client
 * reads, so anything the generator could get wrong has to survive being read.
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
 * Two questions, because they fail separately: whether every artifact is on the
 * release, and whether each manifest describes the assets that are there. The
 * second catches a manifest uploaded beside a different build of the artifact it
 * names — a client sees that as a failed hash after a full download, and a
 * disagreeing size is the same fact for free.
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
