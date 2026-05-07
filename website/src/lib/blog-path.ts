export function blogPath(post: { id: string; data: { date: Date } }): string {
  const date = post.data.date
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const name = post.id.replace(/^\d{4}-\d{2}-\d{2}-/, '')
  return `${y}/${m}/${d}/${name}`
}
