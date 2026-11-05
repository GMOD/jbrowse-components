export function blogPath(post: { id: string }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(post.id)
  if (!match) {
    throw new Error(`Unexpected blog post id: ${post.id}`)
  }
  const [, y, m, d, name] = match
  return `${y}/${m}/${d}/${name}`
}

const EXCERPT_CHARS = 600

// Where a paragraph, list or fence ends: the offset of each blank line outside
// a code fence.
function blockEnds(body: string) {
  const ends: number[] = []
  let offset = 0
  let fenced = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
    } else if (!fenced && line.trim() === '' && offset > 0) {
      ends.push(offset)
    }
    offset += line.length + 1
  }
  return ends
}

// The post's opening blocks, cut at the last block end within EXCERPT_CHARS
// (or the first one, when the opening block runs longer), so no link, tag or
// fence is cut in half.
export function blogExcerpt(body: string) {
  const trimmed = body.trim()
  const ends = blockEnds(trimmed)
  const cut =
    trimmed.length <= EXCERPT_CHARS
      ? undefined
      : (ends.findLast(end => end <= EXCERPT_CHARS) ?? ends[0])
  return cut === undefined
    ? { text: trimmed, truncated: false }
    : { text: trimmed.slice(0, cut).trimEnd(), truncated: true }
}

// The one date format the blog shows, on the post feed and on a post itself.
export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
