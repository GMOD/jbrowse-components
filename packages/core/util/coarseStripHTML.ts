// not a sanitizer, this just removes html tags for use in measureText-based
// element width calculations
export function coarseStripHTML(s: string) {
  let result = ''
  let inTag = false

  for (let i = 0, l = s.length; i < l; i++) {
    const char = s[i]!
    if (char === '<') {
      inTag = true
    } else if (char === '>') {
      inTag = false
    } else if (!inTag) {
      result += char
    }
  }

  return result
}
