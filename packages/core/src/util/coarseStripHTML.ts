// not a sanitizer, this just removes html tags where only the text is shown
export function coarseStripHTML(s: string) {
  return s.replaceAll(/<[^<>]*>/g, '')
}
