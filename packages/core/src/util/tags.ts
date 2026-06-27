// A SAM tag is two characters: a letter followed by a letter or digit.
export const tagRegex = /^[A-Za-z][A-Za-z0-9]$/

export function isValidTag(tag: string) {
  return tagRegex.test(tag)
}
