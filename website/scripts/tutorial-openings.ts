// What `check-tutorial-openings` asserts of one tutorial's text. The opening,
// everything above the first `##`, ends in a bulleted list of the page's stages
// that a sentence ending in a colon introduces.

const MIN_BULLETS = 3
const MAX_BULLETS = 5

export function tutorialOpeningProblems(text: string) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '')
  const firstSection = body.search(/^## /m)
  const opening = (firstSection === -1 ? body : body.slice(0, firstSection))
    .replaceAll(/^:::[\s\S]*?^:::$/gm, '')
    .trim()
  const lines = opening.split('\n')
  const bullets = lines.filter(l => l.startsWith('- '))
  const problems: string[] = []
  if (bullets.length < MIN_BULLETS || bullets.length > MAX_BULLETS) {
    problems.push(
      `the opening has ${bullets.length} bullets; list ${MIN_BULLETS} to ${MAX_BULLETS} stages the page runs`,
    )
  }
  const first = lines.findIndex(l => l.startsWith('- '))
  if (first > 0) {
    const leadIn = lines.slice(0, first).join('\n').trim().split(/\n\n/).pop()!
    if (!leadIn.endsWith(':')) {
      problems.push(
        'the sentence before the opening bullets must end in a colon',
      )
    }
  }
  return problems
}
