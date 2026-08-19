// "did you mean" for a mistyped identifier, shared by the validator and by
// add-track's up-front check on the settings it is about to write.

function editDistance(a: string, b: string) {
  // Two rolling rows rather than the full matrix; these are short identifiers
  // and this runs once per unknown key.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]!
}

// The nearest candidate, if it is near enough to be worth naming. The threshold
// scales with length so `uri` doesn't match every other three-letter slot while
// a longer typo still resolves.
export function suggest(word: string, candidates: string[]) {
  const limit = Math.max(2, Math.floor(word.length / 3))
  let best: string | undefined
  let bestScore = Infinity
  for (const candidate of candidates) {
    const score = editDistance(word.toLowerCase(), candidate.toLowerCase())
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return bestScore <= limit ? best : undefined
}

export function didYouMean(word: string, candidates: string[]) {
  const hit = suggest(word, candidates)
  return hit ? ` — did you mean "${hit}"?` : ''
}
