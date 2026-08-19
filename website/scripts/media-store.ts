// What the media store IS: which files belong to it, how a path shortens to a
// name, and where the manifest lives. The CLI over it is scripts/media.ts, and
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

// Repo-relative, and the only definition of "is this a media file".
//
// MEDIA rather than VIDEO, and the corpus already shows why: every clip ships
// with a poster frame, which is an image, and a caption track, which is text.
// What the boundary is really about is "a file the docs embed that git should
// not carry".
export const mediaRoot = 'website/static/media'
// The three files a clip is: the mp4, the poster frame and the caption track.
// No webm — generate-video.ts writes none, since VP9 measured larger than the
// h264 for this content. That also keeps the per-stretch `.segN.webm` captures
// a clip is stitched from out of the corpus, which matters because
// --keep-segments leaves them in this directory and a store that swept one up
// would publish a fragment as a clip.
export const mediaExtRe = /\.(mp4|jpe?g|vtt)$/i

export const mediaCorpus: BlobCorpus = {
  storePrefix: 'jb2-media',
  // `website/static/media/pangenome/x.mp4` -> `pangenome/x`, and the key adds
  // the extension back: `jb2-media/pangenome/x.<hash>.mp4`. So a clip's three
  // files share a name and differ in the key, which is what `--filter x` wants
  // (it selects a clip, never one of its files).
  name: p => p.replace(`${mediaRoot}/`, '').replace(mediaExtRe, ''),
  extRe: mediaExtRe,
}

// What a message calls a file, where `name` is what a filter and a key use: a
// clip's three files share a name, so a status line printed with it lists the
// same clip three times and says nothing about which file is missing.
export const shortName = (p: string) => p.replace(`${mediaRoot}/`, '')

export const manifestPath = join(repoRoot, 'website', 'media.lock')

// What each file is served as, by extension, stated rather than left to the aws
// CLI's mimetypes guess — which differs by platform, and a clip served as
// application/octet-stream is one a browser offers to download instead of
// playing.
export const contentTypes: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  // charset stated: a <track> served as text/vtt with no charset is decoded by
  // the browser's fallback, and these carry the app's own labels
  '.vtt': 'text/vtt; charset=utf-8',
}

export const MANIFEST_HEADER = `\
# Media manifest — the bytes live in S3, this file is what git tracks. See
# website/scripts/media.ts for why, including what the docs deploy would
# otherwise delete.
#
# One line per file, sorted by path. A clip is three of them: the mp4, its
# poster frame and its caption track. \`pnpm figures\` drives this store beside
# the figure one, and \`pnpm build\` pulls what this file names before astro
# copies static/ into dist/.
#
# <path> <width>x<height> <bytes> <sha256>
`

export function listMediaFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string, prefix: string) => {
    let entries
    try {
      entries = readdirSync(join(repoRoot, dir), { withFileTypes: true })
    } catch {
      // a fresh clone has no static/media, and this is also the thing that
      // repopulates it
      return
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(`${dir}/${entry.name}`, rel)
      } else if (mediaExtRe.test(entry.name)) {
        out.push(`${mediaRoot}/${rel}`)
      }
    }
  }
  walk(mediaRoot, '')
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
    return parseManifest(readFileSync(manifestPath, 'utf8'), 'media.lock')
  } catch {
    return new Map()
  }
}
