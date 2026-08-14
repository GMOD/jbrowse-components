/**
 * Genome search matches every whitespace-separated token somewhere in the row,
 * in any field, rather than the query as one substring. Names are written
 * differently everywhere ("e coli" has to find Escherichia coli, "t2t human"
 * a T2T human assembly), and neither query is a substring of anything.
 */
export function searchTokens(query: string) {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean)
}

export function matchesAllTokens(haystack: string, tokens: string[]) {
  const lower = haystack.toLowerCase()
  return tokens.every(token => lower.includes(token))
}

// any occurrence will do, so this stops at the first one that begins a word
// rather than walking every remaining occurrence with the answer in hand
function startsAWord(haystack: string, token: string) {
  for (
    let i = haystack.indexOf(token);
    i !== -1;
    i = haystack.indexOf(token, i + 1)
  ) {
    if (i === 0 || !/[a-z0-9]/.test(haystack[i - 1]!)) {
      return true
    }
  }
  return false
}

/**
 * How many tokens match at the start of a word, for ranking matches that are
 * all equally "found". "coli" begins a word in `Escherichia coli` but sits
 * mid-word in `Mycolicibacterium` and `nitroguajacolicus`, so without this a
 * search for "e coli" buries actual E. coli under everything that merely
 * contains those letters.
 */
export function countWordStartMatches(haystack: string, tokens: string[]) {
  const lower = haystack.toLowerCase()
  return tokens.filter(token => startsAWord(lower, token)).length
}
