import { readDocSection, splitSections } from './docSections.ts'

const doc = `# Title

Intro paragraph.

## Alpha

Alpha body.

\`\`\`js
## not a heading
\`\`\`

### Alpha child

Child body.

## Beta

Beta body.
`

describe('splitSections', () => {
  it('keeps the preamble and ignores headings inside code fences', () => {
    const headings = splitSections(doc).map(s => s.heading)
    expect(headings).toEqual(['', 'Title', 'Alpha', 'Alpha child', 'Beta'])
  })
})

describe('readDocSection', () => {
  it('returns a short document whole', () => {
    expect(readDocSection(doc, '')).toEqual({ text: doc })
  })

  it('returns a long document as its table of contents', () => {
    const long = `${doc}${'x'.repeat(30_000)}\n`
    const { text } = readDocSection(long, '')
    expect(text).toContain('- Title')
    expect(text).toContain('  - Alpha')
    expect(text).toContain('    - Alpha child')
    expect(text).not.toContain('Alpha body.')
  })

  it('drops frontmatter and indents from the shallowest heading present', () => {
    const fm = `---\ntitle: T\n---\n\nIntro.\n\n## Only\n\nBody.\n\n### Child\n\n${'x'.repeat(30_000)}\n`
    const { text } = readDocSection(fm, '')
    expect(text!.startsWith('Intro.')).toBe(true)
    expect(text).not.toContain('title: T')
    expect(text).toContain('\n- Only\n  - Child')
  })

  it('returns a section with its subsections, matched case-insensitively', () => {
    const { text } = readDocSection(doc, 'alpha')
    expect(text).toContain('Alpha body.')
    expect(text).toContain('Child body.')
    expect(text).not.toContain('Beta body.')
  })

  it('prefers an exact heading over a substring match', () => {
    const { text } = readDocSection(doc, 'Alpha child')
    expect(text).toContain('Child body.')
    expect(text).not.toContain('Alpha body.')
  })

  it('names the sections when the requested one is missing', () => {
    const { error } = readDocSection(doc, 'gamma')
    expect(error).toContain('No section "gamma"')
    expect(error).toContain('- Beta')
  })

  it('returns everything for "all"', () => {
    const long = `${doc}${'x'.repeat(30_000)}\n`
    expect(readDocSection(long, 'all')).toEqual({ text: long })
  })
})
