/**
 * Genome search matches every whitespace-separated token somewhere in the row,
 * in any field, rather than the query as one substring. Names are written
 * differently everywhere ("e coli" has to find Escherichia coli, "t2t human"
 * a T2T human assembly), and neither query is a substring of anything. The
 * highlight marks the same tokens the search matched.
 */
export function searchTokens(query: string) {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean)
}
