export function blogPath(post: { id: string }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(post.id)
  if (!match) {
    throw new Error(`Unexpected blog post id: ${post.id}`)
  }
  const [, y, m, d, name] = match
  return `${y}/${m}/${d}/${name}`
}
