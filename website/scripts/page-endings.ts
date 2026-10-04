// What `check-page-endings` asserts of one tutorial's text. A tutorial closes
// with `## See also`, `## External links`, then `## Citations`, each only when
// it has entries, and no `##` section after them; a See also bullet links a
// page on jbrowse.org. website/docs/tutorials/CLAUDE.md says what goes in each.

const ENDINGS = ['See also', 'External links', 'Citations']
const RETIRED = new Set(['References'])
const OURS = /\]\((\/|https:\/\/jbrowse\.org\/)/

export function pageEndingProblems(text: string) {
  const problems: string[] = []
  const headings = [...text.matchAll(/^## (.+)$/gm)].map(m => ({
    name: m[1]!.trim(),
    index: m.index,
  }))
  for (const h of headings) {
    if (RETIRED.has(h.name)) {
      problems.push(
        `## ${h.name}: split it into ## External links and ## Citations`,
      )
    }
  }
  const firstEnding = headings.findIndex(h => ENDINGS.includes(h.name))
  if (firstEnding !== -1) {
    const tail = headings.slice(firstEnding).map(h => h.name)
    const stray = tail.filter(name => !ENDINGS.includes(name))
    if (stray.length > 0) {
      problems.push(`## ${stray.join(', ## ')} after the closing sections`)
    }
    const order = tail.filter(name => ENDINGS.includes(name))
    const sorted = [...order].sort(
      (a, b) => ENDINGS.indexOf(a) - ENDINGS.indexOf(b),
    )
    if (
      order.join(',') !== sorted.join(',') ||
      new Set(order).size < order.length
    ) {
      problems.push(`closing sections out of order: ${order.join(', ')}`)
    }
  }
  const seeAlso = headings.find(h => h.name === 'See also')
  if (seeAlso) {
    const next = headings.find(h => h.index > seeAlso.index)
    const body = text.slice(seeAlso.index, next?.index ?? text.length)
    for (const line of body.split('\n')) {
      if (line.startsWith('- ') && !OURS.test(line)) {
        problems.push(
          `See also links off-site, move it to External links: ${line}`,
        )
      }
    }
  }
  return problems
}
