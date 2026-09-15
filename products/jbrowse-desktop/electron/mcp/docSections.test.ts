import fs from 'node:fs'

import { OMITTED_SECTIONS, SPLIT_TOPICS } from './docLimits.ts'
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
    expect(text).toMatch(/- Title \(\d+ chars\)/)
    expect(text).toMatch(/\n  - Alpha \(\d+ chars\)/)
    expect(text).toMatch(/\n    - Alpha child \(\d+ chars\)/)
    expect(text).not.toContain('Alpha body.')
  })

  it('drops frontmatter and indents from the shallowest heading present', () => {
    const fm = `---\ntitle: T\n---\n\nIntro.\n\n## Only\n\nBody.\n\n### Child\n\n${'x'.repeat(30_000)}\n`
    const { text } = readDocSection(fm, '')
    expect(text!.startsWith('Intro.')).toBe(true)
    expect(text).not.toContain('title: T')
    expect(text).toMatch(/\n- Only \(\d+ chars\)\n  - Child \(\d+ chars\)/)
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

  // The live-model guide is the contract every agent is told to read first, so
  // a bare read of it answers with the contract whole and a table of contents
  // of what is below the split. A long topic with no split still answers with
  // its headings alone.
  it('splits a topic into the text above a heading and a contents below it', () => {
    const { text } = readDocSection(doc, '', { splitAt: 'Alpha' })
    expect(text).toContain('Intro paragraph.')
    expect(text).toContain('## Alpha')
    expect(text).not.toContain('Beta body.')
    expect(text).toContain('Pass one as "section" to read it')
    expect(text).toMatch(/- Beta \(\d+ chars\)/)
    expect(text).not.toMatch(/- Alpha \(/)
  })

  it('answers a long unsplit topic with its headings', () => {
    const long = `${doc}${'x'.repeat(30_000)}\n`
    expect(readDocSection(long, '').text).toContain('Sections (pass one as')
  })

  // The server runs inside Desktop, so the guide's browser-agent section is
  // 1.8 KB about a client that cannot be the one asking.
  describe('an omitted section', () => {
    it('is gone from the contents, from "all" and from a lookup', () => {
      const { text } = readDocSection(doc, '', {
        splitAt: 'Alpha',
        omit: ['Beta'],
      })
      expect(text).not.toMatch(/- Beta \(/)
      expect(readDocSection(doc, 'all', { omit: ['Beta'] }).text).not.toContain(
        'Beta body.',
      )
      expect(readDocSection(doc, 'Beta', { omit: ['Beta'] }).error).toContain(
        'No section "Beta"',
      )
    })

    it('takes its subsections with it', () => {
      const { text } = readDocSection(doc, 'all', { omit: ['Alpha'] })
      expect(text).not.toContain('Alpha body.')
      expect(text).not.toContain('Child body.')
      expect(text).toContain('Beta body.')
    })
  })
})

// The bare answer is what every agent is told to read before its first
// run_javascript call, so its size is a fixed per-session cost. It was the
// whole 23 KB guide until the split; the deep dives are now asked for by name.
describe('the live-model guide as the docs tool serves it', () => {
  const guide = fs.readFileSync(
    `${__dirname}/../../../../website/docs/agents_live_model.md`,
    'utf8',
  )
  const bare = () =>
    readDocSection(guide, '', {
      splitAt: SPLIT_TOPICS['live-model'],
      omit: OMITTED_SECTIONS['live-model'],
    }).text!

  it('answers the bare read in under 10000 characters', () => {
    expect(bare().length).toBeLessThanOrEqual(10_000)
  })

  it('carries the contract whole, then the deep dives as a contents', () => {
    const text = bare()
    expect(text).toContain('## The helper library')
    expect(text).toContain('## Waiting on the app')
    expect(text).toContain('## Deep dives')
    expect(text).not.toContain('## The model, oriented\n')
    expect(text).toMatch(/- The model, oriented \(\d+ chars\)/)
    expect(text).toMatch(/- Reading data directly \(fast path\) \(\d+ chars\)/)
  })

  it('leaves the browser section out of both the contents and "all"', () => {
    expect(bare()).not.toContain('In a browser')
    expect(
      readDocSection(guide, 'all', { omit: OMITTED_SECTIONS['live-model'] })
        .text,
    ).not.toContain('## In a browser')
  })

  it('still reads a deep dive by name', () => {
    const { text } = readDocSection(guide, 'The model, oriented', {
      splitAt: SPLIT_TOPICS['live-model'],
      omit: OMITTED_SECTIONS['live-model'],
    })
    expect(text).toContain('view.hideTrack')
  })
})
