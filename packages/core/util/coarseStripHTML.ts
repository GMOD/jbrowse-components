export function coarseStripHTML(s: string) {
  return s.replaceAll(/<[^>]*>/gi, '')
}
