// What the video store IS: which files belong to it, how a path shortens to a
// name, and where the manifest lives. The CLI over it is scripts/videos.ts, and
// the reasoning for having a store at all is there too.
//
// Split from that CLI for the same reason figure-store.ts is split from
// figures.ts: this half is imported by things that are not a store command —
// check-figure-refs.ts asks the manifest whether a doc names a clip that exists
// — and importing the CLI would run it.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  hashBuffer,
  imageSize,
  parseManifest,
} from '@jbrowse/browser-test-utils/blobStore'

import { repoRoot } from './paths.ts'

import type {
  BlobCorpus,
  BlobEntry,
} from '@jbrowse/browser-test-utils/blobStore'

// Repo-relative, and the only definition of "is this a video". The poster frames
// are in the corpus too: a poster is written by the same run, from the clip it
// belongs to, and a manifest that tracked the mp4 without it would publish an
// embed whose still is missing.
export const videoRoot = 'website/static/video'
// mp4 and the poster, which is everything a clip is: generate-video.ts writes no
// webm (it measured larger than the h264 for this content). That also keeps the
// per-stretch `.segN.webm` captures a clip is stitched from out of the corpus,
// which matters because --keep-segments leaves them in this directory and a
// store that swept one up would publish a fragment as a clip.
export const videoExtRe = /\.(mp4|jpe?g)$/i

export const videoCorpus: BlobCorpus = {
  storePrefix: 'jb2-video',
  // `website/static/video/pangenome/x.mp4` -> `pangenome/x`, and the key adds
  // the extension back: `jb2-video/pangenome/x.<hash>.mp4`. So a clip's two
  // files share a name and differ in the key, which is what `--filter x` wants
  // (it selects a clip, never one of its files).
  name: p => p.replace(`${videoRoot}/`, '').replace(videoExtRe, ''),
  extRe: videoExtRe,
}

// What a message calls a file, where `name` is what a filter and a key use: a
// clip's two files share a name, so a status line printed with it lists the same
// clip twice and says nothing about which file is missing.
export const shortName = (p: string) => p.replace(`${videoRoot}/`, '')

export const manifestPath = join(repoRoot, 'website', 'video.lock')

// What each file is served as, by extension, stated rather than left to the aws
// CLI's mimetypes guess — which differs by platform, and a clip served as
// application/octet-stream is one a browser offers to download instead of
// playing.
export const contentTypes: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export const MANIFEST_HEADER = `\
# Video manifest — the bytes live in S3, this file is what git tracks. See
# website/scripts/videos.ts for why, including what the docs deploy would
# otherwise delete.
#
# One line per file, sorted by path. A clip is two of them: the mp4 and its
# poster frame. \`pnpm videos\` is the CLI; \`pnpm build\` pulls what this file
# names before astro copies static/ into dist/.
#
# <path> <width>x<height> <bytes> <sha256>
`

export function listVideoFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string, prefix: string) => {
    let entries
    try {
      entries = readdirSync(join(repoRoot, dir), { withFileTypes: true })
    } catch {
      // a fresh clone has no static/video, and this is also the thing that
      // repopulates it
      return
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(`${dir}/${entry.name}`, rel)
      } else if (videoExtRe.test(entry.name)) {
        out.push(`${videoRoot}/${rel}`)
      }
    }
  }
  walk(videoRoot, '')
  return out.sort()
}

export function describeFile(relPath: string): BlobEntry {
  const buf = readFileSync(join(repoRoot, relPath))
  return {
    path: relPath,
    sha256: hashBuffer(buf),
    bytes: buf.length,
    // parses the poster frame and returns nothing for the clips, which is what
    // the manifest's `-` column means
    ...imageSize(buf),
  }
}

export function readManifest(): Map<string, BlobEntry> {
  try {
    return parseManifest(readFileSync(manifestPath, 'utf8'), 'video.lock')
  } catch {
    return new Map()
  }
}
