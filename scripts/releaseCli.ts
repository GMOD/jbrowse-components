// Shared entry plumbing for releasenotes.ts and announce.ts. Both point at one
// release post via `--tag` and both are run by a human at a terminal or by a
// workflow step reading the log, so both want the same thing: the post, or one
// line saying why not.
//
// Kept out of releaseBlog.ts, which is the pure render/parse layer jest loads —
// this half resolves paths off import.meta and exits the process.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  findReleasePost,
  parseReleaseFilename,
  parseReleasePost,
} from './releaseBlog.ts'
import { parseTagArg } from './releaseVersion.ts'

export const BLOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../website/blog',
)

// The post `--tag` names, or the newest one, with everything both callers read
// off it — body and title from the file, date parts and tag from the filename,
// so the notes and the URLs built from them describe the same release.
//
// Every throw underneath is a user-facing condition: a `--tag` whose value the
// shell ate, a tag with no post (which is the normal case for a prerelease, and
// how release.yml decides to fall back to an empty release body), a post whose
// frontmatter got mangled. The caller has nothing to add to any of them, so
// this reports and exits instead of letting a stack trace stand in for the
// message.
export function loadReleasePost(argv: string[], blogDir = BLOG_DIR) {
  try {
    const file = findReleasePost(parseTagArg(argv), blogDir)
    const { body, title } = parseReleasePost(
      readFileSync(path.join(blogDir, file), 'utf8'),
      file,
    )
    return { file, body, title, ...parseReleaseFilename(file) }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }
}
