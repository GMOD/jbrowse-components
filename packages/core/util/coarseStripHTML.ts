// not a sanitizer, this just removes html tags for use in measureText-based
// element width calculations
export function coarseStripHTML(s: string) {
  return s.replace(/<|>/g, '')
}
