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
export function renderReleasePost({
  template,
  tag,
  date,
  notes,
  changelog,
}: {
  template: string
  tag: string
  date: string
  notes: string
  changelog: string
}) {
  const vars: Record<string, string> = {
    RELEASE_TAG: tag,
    DATE: date,
    NOTES: prepareDraftNotes(notes),
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
