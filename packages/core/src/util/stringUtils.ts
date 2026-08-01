export function shorten(name: string, max = 70, short = 30) {
  return name.length > max
    ? `${name.slice(0, short)}...${name.slice(-short)}`
    : name
}

export function shorten2(name: string, max = 70) {
  return name.length > max ? `${name.slice(0, max)}...` : name
}

export function truncateMiddle(str: string, maxLen = 40) {
  if (str.length <= maxLen) {
    return str
  }
  const half = Math.floor((maxLen - 3) / 2)
  return `${str.slice(0, half)}...${str.slice(-half)}`
}

// Regular-plural noun for a count, for the "N hidden features" / "Clear N
// highlights" family of labels. Takes the count rather than returning a bare
// suffix so the call site reads as the sentence it produces, and so `0` pairs
// with the plural ("0 features") the way English does — the hand-written
// `n > 1 ? 's' : ''` scattered around got that right only because every one of
// those labels was already gated on n > 0.
export function pluralize(count: number, noun: string) {
  return count === 1 ? noun : `${noun}s`
}

// Sentence-case a noun that arrives lowercase because it also appears
// mid-sentence — the display nouns ('feature', 'read', 'variant') that name
// what a track holds are the case this exists for.
export function capitalizeFirst(s: string) {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`
}
