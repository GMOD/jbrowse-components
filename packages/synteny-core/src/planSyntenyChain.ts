/**
 * Order a set of assemblies into the linear chain with the most connected
 * adjacent pairs. A LinearSyntenyView is a stack where level i only draws
 * ribbons between rows i and i+1, so a multi-way view is only useful when
 * adjacent rows share a synteny dataset. Rather than make the user find a valid
 * ordering by hand, this greedily builds a chain: start from the most-connected
 * assembly (a hub belongs in the middle) and extend from whichever end still
 * has a connected candidate, matching the both-ends growth used for
 * cross-species synteny chains. Assemblies with no connection to either end are
 * appended anyway, leaving a gap the user can resolve, instead of being dropped.
 *
 * `isConnected` is injected (typically `getSyntenyTracks(tracks, [a, b])` is
 * non-empty) so the algorithm stays pure and testable.
 */
export function planSyntenyChain(
  assemblies: string[],
  isConnected: (a: string, b: string) => boolean,
): string[] {
  if (assemblies.length <= 2) {
    return [...assemblies]
  }
  const pool = [...assemblies]
  const degree = (a: string) =>
    pool.filter(b => b !== a && isConnected(a, b)).length
  let startIdx = 0
  for (let i = 1; i < pool.length; i++) {
    if (degree(pool[i]!) > degree(pool[startIdx]!)) {
      startIdx = i
    }
  }
  const chain = [pool.splice(startIdx, 1)[0]!]
  while (pool.length) {
    const head = chain[0]!
    const tail = chain[chain.length - 1]!
    const tailIdx = pool.findIndex(a => isConnected(tail, a))
    if (tailIdx >= 0) {
      chain.push(pool.splice(tailIdx, 1)[0]!)
    } else {
      const headIdx = pool.findIndex(a => isConnected(head, a))
      if (headIdx >= 0) {
        chain.unshift(pool.splice(headIdx, 1)[0]!)
      } else {
        chain.push(pool.shift()!)
      }
    }
  }
  return chain
}
