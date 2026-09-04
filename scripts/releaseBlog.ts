// Render, locate, and parse release blog posts. release.ts writes the post,
// releasenotes.ts turns it back into the GitHub release body, and announce.ts
// into the social/newsletter copy — so the template and the parsers that must
// agree with it live together, covered by releaseBlog.test.ts.
//
// Kept free of import.meta (and so of any repo-root constant) so jest can load
// it; callers pass the blog dir and template in.
import { readdirSync } from 'node:fs'

export const REPO = 'GMOD/jbrowse-components'

// Release posts are named YYYY-MM-DD-vX.Y.Z-release.md. Requiring the version
// in the slug means a non-release post (office hours, etc.) is never picked.
const RELEASE_FILE = /^(\d{4})-(\d{2})-(\d{2})-(v\d+\.\d+\.\d+.*)\.md$/

export function releasePostFilename(tag: string, date: string) {
  return `${date}-${tag}-release.md`
}

// The two shapes a release needs a clock in: `date` names the post file and
// orders the blog, `datetime` is its frontmatter. Local time on purpose — the
// post is dated the day whoever cut it cut it.
//
// A helper rather than four lines at the call site because getMonth() is
// 0-based and getDate()/getDay() differ by one letter, and a release runs once
// a month with no dry run. `Intl`/`toISOString` are not alternatives: the first
// is locale-dependent and the second is UTC, which puts an evening release on
// tomorrow's date.
export function releaseTimestamp(now: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
  return { date, datetime: `${date} ${time}` }
}

export const DRAFTS_DIR = 'website/release_announcement_drafts'

// The two files a release can be handed, both consumed by the run that ships
// them. `notes` is required and becomes the human summary; `changelog` is
// optional and replaces the generated PR list when the generated one would
// misrepresent the release — v5.0.0 is 9051 commits behind 16 PRs, because the
// work landed on main directly rather than through pull requests.
export const releaseDraftPaths = (tag: string) => ({
  notes: `${DRAFTS_DIR}/${tag}.md`,
  changelog: `${DRAFTS_DIR}/${tag}.changelog.md`,
})

// splitReleaseBody finds the changelog section by this heading, so an override
// that omits it silently drops the whole section from the GitHub release body.
export const CHANGELOG_HEADING = /^#+\s+Changes since\b/

// The newest commit a hand-written changelog covers, which nothing else in the
// draft records: it names no PRs and no hashes, so how far behind main it has
// fallen is unanswerable from the file. Written as an HTML comment, which
// prepareDraftNotes strips, so the marker never reaches the published post.
//
// The failure it exists for is silent and has already happened: the v5.0.0
// changelog sat at one commit for 604 more, every one of them a change it
// claims to list.
export const CHANGELOG_THROUGH =
  /<!--\s*changelog-through:\s*([0-9a-f]{7,40})\s*-->/

export function changelogThrough(md: string) {
  return CHANGELOG_THROUGH.exec(md)?.[1]
}

// How many commits past the marker is worth saying something about. A warning
// rather than a failure: a draft goes stale by the tree moving, so failing on
// it would redden every branch that touched nothing.
export const CHANGELOG_STALE_AT = 100

// Where the site serves website/static/img once deployed.
const SITE_IMG = 'https://jbrowse.org/jb2/img/'

// Matches a markdown image's target, so only image URLs are rewritten and a
// literal "/img/..." elsewhere in the prose is left alone.
const imageTarget = /(!\[[^\]]*\]\()([^)]+)(\))/g

// A draft may address figures repo-relatively (../static/img/foo.png) so they
// render in the GitHub file view while it is being reviewed. The site serves
// that directory at /img, so the paths have to be site-root by the time the
// post is written — and release.ts commits, tags and pushes in one run, so
// there is no later chance to fix them. Normalizing here rather than asking
// the author to remember means a draft is reviewable and publishable at once.
function normalizeDraftImages(md: string) {
  return md.replaceAll(imageTarget, (whole, open, url: string, close) =>
    url.startsWith('../static/img/')
      ? `${open}${url.replace('../static/img/', '/img/')}${close}`
      : whole,
  )
}

// Everything a draft carries for the person publishing it — what still needs
// filling in, how the figures were sourced — belongs in an HTML comment, which
// is invisible on the blog but not everywhere downstream: announce.ts escapes
// HTML, so a comment reaches the newsletter as visible "<!--" text.
function stripHtmlComments(md: string) {
  return md.replaceAll(/<!--[\s\S]*?-->/g, '')
}

// Turn a reviewed draft into publishable notes. release.ts runs this on the way
// into the blog post, so it is the one place a draft-only convenience gets
// undone; everything downstream reads the post, never the draft.
export function prepareDraftNotes(md: string) {
  return normalizeDraftImages(stripHtmlComments(md))
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

// A figure a draft cannot hold because it moves under every commit. The v5.0.0
// draft stated its own diffstat and was 18.4% under on deletions within days of
// being written; the answer is not a fresher number but a number the release
// computes. `pnpm autogen` cannot own one either — an artifact that goes stale
// on every commit fails the check on every commit.
//
// The stat names a draft may write, so an unknown `${…}` is a typo that would
// otherwise publish literally. check-release-drafts rejects those; this is the
// list it rejects against.
export const RELEASE_STAT_NAMES = ['DIFFSTAT'] as const

export type ReleaseStats = Partial<
  Record<(typeof RELEASE_STAT_NAMES)[number], string>
>

// `git diff --shortstat`, in the draft's own voice. Reformatted rather than
// quoted so the sentence around it reads: git writes "9166 files changed,
// 1011355 insertions(+), 295862 deletions(-)".
export function formatDiffstat(shortstat: string) {
  const n = (re: RegExp) => {
    const found = re.exec(shortstat)?.[1]
    return found === undefined
      ? undefined
      : Number(found).toLocaleString('en-US')
  }
  const files = n(/(\d+) files? changed/)
  const insertions = n(/(\d+) insertions?\(\+\)/)
  const deletions = n(/(\d+) deletions?\(-\)/)
  if (!files || !insertions || !deletions) {
    throw new Error(`Cannot read a diffstat out of "${shortstat}"`)
  }
  return `${files} files changed, +${insertions} / \u2212${deletions} lines`
}

// Substitute the release-day stats a draft asked for. Separate from
// `prepareDraftNotes` because that one runs in check-release-drafts too, where
// there is no release to compute against.
export function fillReleaseStats(md: string, stats: ReleaseStats) {
  return md.replaceAll(
    /\$\{(\w+)\}/g,
    (whole, name: string) => stats[name as keyof ReleaseStats] ?? whole,
  )
}

// The GitHub release body is rendered by GitHub, not by the website, so a
// site-root path there resolves against github.com and misses the figure.
export function absolutizeImages(md: string) {
  return md.replaceAll(imageTarget, (whole, open, url: string, close) =>
    url.startsWith('/img/')
      ? `${open}${url.replace('/img/', SITE_IMG)}${close}`
      : whole,
  )
}

// The newsletter takes the prose only. mdToHtml has no image case, so a figure
// would arrive as a line of literal markdown, and a figure-heavy post would
// arrive as dozens of them — the mail links out to the full post anyway.
export function stripImages(md: string) {
  return md
    .replaceAll(/^!\[[^\]]*\]\([^)]*\)[^\S\n]*\n?/gm, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

// Fill blog_template.txt. Unknown ${...} placeholders are left alone.
//
// The draft's own placeholders are filled first, and have to be: this pass
// substitutes into the TEMPLATE, and a replacement value is inserted literally
// rather than rescanned, so a `${DIFFSTAT}` arriving inside NOTES would reach
// the published post as those nine characters.
export function renderReleasePost({
  template,
  tag,
  date,
  notes,
  changelog,
  stats = {},
}: {
  template: string
  tag: string
  date: string
  notes: string
  changelog: string
  stats?: ReleaseStats
}) {
  const vars: Record<string, string> = {
    RELEASE_TAG: tag,
    DATE: date,
    NOTES: fillReleaseStats(prepareDraftNotes(notes), stats),
    CHANGELOG: changelog,
  }
  return template.replaceAll(
    /\$\{(\w+)\}/g,
    (whole, name) => vars[name] ?? whole,
  )
}

// The post for a tag, or the newest without one. The date prefix makes lexical
// order chronological, so this is stable regardless of mtimes. Selecting by tag
// matters: relabeling only the URLs would announce one release's notes under
// another's links.
export function findReleasePost(tag: string | undefined, blogDir: string) {
  const posts = readdirSync(blogDir)
    .filter(f => RELEASE_FILE.test(f))
    .sort()
  const match = tag
    ? posts.findLast(f => parseReleaseFilename(f).tag === tag)
    : posts.at(-1)
  if (!match) {
    throw new Error(
      tag
        ? `no release blog post for ${tag} in ${blogDir}`
        : `no release blog posts found in ${blogDir}`,
    )
  }
  return match
}

export function parseReleaseFilename(filename: string) {
  const m = RELEASE_FILE.exec(filename)
  if (!m) {
    throw new Error(`unexpected release blog filename: ${filename}`)
  }
  const [, y, mo, d, slug] = m
  return { y, m: mo, d, slug, tag: /v\d+\.\d+\.\d+/.exec(slug!)![0] }
}

export function parseReleasePost(raw: string, filename: string) {
  const fm = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
  if (!fm) {
    throw new Error(`no frontmatter in ${filename}`)
  }
  const [, frontmatter, body] = fm
  const title = /^title:\s*(.+)$/m.exec(frontmatter!)?.[1]?.trim() ?? filename
  return { frontmatter, body: body!, title }
}

// The human summary is everything before "## Downloads"; the autogenerated
// changelog is the "## Changes since ..." section after it.
export function splitReleaseBody(body: string) {
  const notes = body.split(/\n#+\s+Downloads/)[0]!.trim()
  const changelog = /\n#+\s+Changes since[\s\S]*$/.exec(body)?.[0].trim() ?? ''
  return { notes, changelog }
}
