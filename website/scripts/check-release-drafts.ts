// Validates the pending release announcement drafts in
// website/release_announcement_drafts/.
//
// This exists because `pnpm release` has no second chance. It renders the draft
// into a blog post, prepends the changelog, commits, tags and pushes in one
// run, and the tag is what CI publishes from — so a draft mistake is live
// before anyone reads the post. The rules below are the ones PUBLISHING.md
// already states and nothing enforced: they were found by rendering the v5.0.0
// draft by hand and noticing two figures that do not exist.
//
// Run: `pnpm check-release-drafts`, or the root `pnpm check-docs`, which is how
// CI reaches it. A draft is checked from the day it is committed, which is the
// point — there is no useful moment to learn this on release day.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  CHANGELOG_HEADING,
  DRAFTS_DIR,
  RELEASE_STAT_NAMES,
  prepareDraftNotes,
} from '../../scripts/releaseBlog.ts'
import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const DRAFTS = join(repoRoot, DRAFTS_DIR)
const VERSION = String.raw`v\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?`
// release.ts looks the draft up as `<tag>.md`, so anything else is a file that
// will never be found on release day.
const DRAFT_NAME = new RegExp(`^${VERSION}\\.md$`)
// The optional hand-written changelog that replaces the generated PR list.
const CHANGELOG_NAME = new RegExp(`^${VERSION}\\.changelog\\.md$`)

// Figures live in S3 and are materialized by `pnpm figures:pull`, so a runner
// that has not pulled has none of them on disk. figures.lock is the authority
// on what exists; on-disk is the fallback for a figure added but not yet
// pushed.
const lockedFigures = new Set(
  existsSync(join(repoRoot, 'figures.lock'))
    ? readFileSync(join(repoRoot, 'figures.lock'), 'utf8')
        .split('\n')
        .map(line => line.split(' ')[0])
        .filter((p): p is string => Boolean(p))
    : [],
)

const figureExists = (repoPath: string) =>
  lockedFigures.has(repoPath) || existsSync(join(repoRoot, repoPath))

// The template supplies the frontmatter, the `## Downloads` block and the
// generated changelog. A draft carrying its own gets two of each — and for
// Downloads that is worse than cosmetic, since splitReleaseBody cuts the human
// summary at the FIRST one, so everything the author wrote after theirs is
// dropped from the GitHub release body and the newsletter.
const BANNED = [
  {
    re: /^---\s*$/m,
    what: 'frontmatter fence — scripts/blog_template.txt supplies it',
  },
  {
    re: /^#+\s+Downloads/m,
    what: 'a `## Downloads` heading — the template supplies it, and the summary is cut at the first one',
  },
  {
    re: /^#+\s+Changes since/m,
    what: 'a `## Changes since` heading — generate-changelog.sh supplies it',
  },
  {
    re: /^#\s+(?!#)/m,
    what: 'a top-level `#` heading — the post title comes from the frontmatter, so start at `##`',
  },
]

// Read off the raw draft, before prepareDraftNotes strips comments, so the
// escape hatch itself never reaches the published post.
const PRERELEASE_WORDING_OK = '<!-- prerelease-wording-ok -->'

const problems: string[] = []
const drafts = existsSync(DRAFTS)
  ? readdirSync(DRAFTS)
      .filter(f => f.endsWith('.md'))
      .sort()
  : []

for (const file of drafts) {
  const flag = (msg: string) => problems.push(`  ${file}: ${msg}`)
  // The changelog override is prose release.ts drops in verbatim, so the only
  // thing that can be wrong with it is the heading splitReleaseBody keys on.
  if (CHANGELOG_NAME.test(file)) {
    const body = readFileSync(join(DRAFTS, file), 'utf8').trim()
    if (!CHANGELOG_HEADING.test(body)) {
      flag(
        'must start with a `## Changes since …` heading, or the section is dropped from the GitHub release body and the newsletter',
      )
    }
    const tag = file.replace(/\.changelog\.md$/, '')
    if (!existsSync(join(DRAFTS, `${tag}.md`))) {
      flag(`has no matching ${tag}.md, so no release will ever consume it`)
    }
    continue
  }
  if (!DRAFT_NAME.test(file)) {
    flag('name is not `v<version>.md`, so `pnpm release` will never find it')
    continue
  }
  // A prerelease ships packages and binaries but gets no blog post, so
  // release.ts never calls readReleaseDocs for one and a draft named after a
  // prerelease tag is read by nothing, ever. The draft that matters is the
  // stable one the beta series lands on.
  if (file.includes('-')) {
    flag(
      `is named after a prerelease tag; prereleases get no blog post, so this is never consumed. Name it after the stable release it describes (${file.split('-')[0]}.md)`,
    )
    continue
  }
  const source = readFileSync(join(DRAFTS, file), 'utf8')
  // Every draft here is named after a STABLE tag (the check above rejects the
  // other kind), and the stable release is the only thing that ever renders one
  // -- so a draft describing itself as a prerelease publishes that claim as the
  // final post, and mails it to the newsletter and the social accounts too. It
  // is an easy state to reach honestly: the v5.0.0 draft was written during a
  // planned beta period, in the beta's voice, and would have gone out opening
  // "This is the prerelease of JBrowse 2 v5.0.0". Cutting the beta itself is
  // unaffected, since `pnpm release --version X-beta.N` consumes no draft.
  if (!source.includes(PRERELEASE_WORDING_OK)) {
    for (const [word] of source.matchAll(/\bpre-?releases?\b/gi)) {
      flag(
        `describes itself as a "${word}", but this draft is only ever rendered as the STABLE ${file.replace(/\.md$/, '')} post. Rewrite it in the release's own voice, or add ${PRERELEASE_WORDING_OK} if the mention is about some other release`,
      )
    }
  }
  // Check what release.ts will actually write, not the source: a repo-relative
  // figure path is legal in the draft and normalized on the way in.
  const notes = prepareDraftNotes(source)
  if (notes === '') {
    flag('is empty once comments are stripped')
  }
  for (const { re, what } of BANNED) {
    if (re.test(notes)) {
      flag(`contains ${what}`)
    }
  }
  // A `${...}` the release does not fill reaches the post as those characters.
  // The whole point of the placeholder is that the figure behind it moves under
  // every commit, so nobody proofreading the draft can catch a misspelled one by
  // noticing the number is wrong -- there is no number there to notice.
  for (const [, name] of notes.matchAll(/\$\{(\w+)\}/g)) {
    if (!(RELEASE_STAT_NAMES as readonly string[]).includes(name!)) {
      flag(
        `writes \`\${${name}}\`, which no release fills, so it publishes literally. The stats a draft may ask for: ${RELEASE_STAT_NAMES.join(', ')}`,
      )
    }
  }
  for (const [, url] of notes.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    if (url!.startsWith('/img/')) {
      const repoPath = `website/static${url}`
      if (!figureExists(repoPath)) {
        flag(`figure does not exist: ${url}`)
      }
    } else if (!url!.startsWith('http')) {
      flag(
        `figure path \`${url}\` is neither \`/img/…\`, \`../static/img/…\` nor absolute`,
      )
    }
  }
}

reportProblems(
  problems.length > 0
    ? [
        `Found ${problems.length} problem(s) in website/release_announcement_drafts/:\n`,
        ...problems,
        '\nSee PUBLISHING.md. A draft is rendered, committed, tagged and pushed',
        'in one `pnpm release` run, so these cannot be fixed after the fact.',
      ]
    : [],
  drafts.length > 0
    ? `${drafts.length} release draft(s) are well formed.`
    : 'No pending release drafts.',
)
