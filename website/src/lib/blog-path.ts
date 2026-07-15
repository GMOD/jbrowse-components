export function blogPath(post: { id: string }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(post.id)
  if (!match) {
    throw new Error(`Unexpected blog post id: ${post.id}`)
  }
  const [, y, m, d, name] = match
  return `${y}/${m}/${d}/${name}`
}

// Shared by the blog index and the RSS feed so both show the same preview
// length (they previously each hard-coded 600 and had to be kept in sync).
const EXCERPT_CHARS = 600

export function blogExcerpt(body: string): { text: string; truncated: boolean } {
  const truncated = body.length > EXCERPT_CHARS
  return { text: truncated ? body.slice(0, EXCERPT_CHARS) : body, truncated }
}
