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

  // A generated type page is one `# Name` with Actions/Getters/Properties/
  // Methods under it, and the summary, the composes line and the example hang
  // off the title, not above it. Served as "the text above the first heading"
  // the bare answer was 270 characters of contents for a 71 KB page, whose only
  // offer was the whole page under its own title and whose next-cheapest was a
  // 48 KB getter list.
  it('returns a long document as its title text and a contents below it', () => {
    const long = `${doc}${'x'.repeat(30_000)}\n`
    const { text } = readDocSection(long, '')
    expect(text!.startsWith('# Title\n\nIntro paragraph.')).toBe(true)
    expect(text).toMatch(/- Alpha \(\d+ chars\)/)
    expect(text).toMatch(/\n  - Alpha child \(\d+ chars\)/)
    expect(text).not.toMatch(/- Title \(/)
    expect(text).not.toContain('Alpha body.')
  })

  // Two titles is a concatenation, not a page, so neither one speaks for the
  // document and the contents offers both.
  it('offers both titles when a document has more than one', () => {
    const two = `${doc}\n# Second\n\n${'x'.repeat(30_000)}\n`
    const { text } = readDocSection(two, '')
    expect(text).toMatch(/- Title \(\d+ chars\)/)
    expect(text).toMatch(/- Second \(\d+ chars\)/)
    expect(text).not.toContain('Intro paragraph.')
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

  // Two eval runs asked for section "LinearGenomeView" while the heading reads
  // "Linear genome view", and got an error.
  describe('a type name against a prose heading', () => {
    const spec = `# Session spec

Intro.

## Linear genome view (simple)

Simple body.

## Linear genome view

View body.

## Linear synteny view

Synteny body.
`
    it('matches once both sides are lowercase alphanumerics', () => {
      expect(readDocSection(spec, 'LinearSyntenyView').text).toContain(
        'Synteny body.',
      )
    })

    it('prefers the heading that matches whole over one it is a prefix of', () => {
      const { text } = readDocSection(spec, 'LinearGenomeView')
      expect(text).toContain('View body.')
      expect(text).not.toContain('Simple body.')
    })

    it('still finds a heading only a substring names', () => {
      expect(readDocSection(spec, 'simple').text).toContain('Simple body.')
    })

    // the loose pass keeps the separators: without them "views" is a substring
    // of "lineargenomeviewsimple", so a real request landed two sections away
    it('does not match across the words of another heading', () => {
      const doc = `${spec}\n## Tiled views / Workspaces\n\nTiled body.\n`
      expect(readDocSection(doc, 'Views').text).toContain('Tiled body.')
    })
  })

  it('names the sections when the requested one is missing', () => {
    const { error } = readDocSection(doc, 'gamma')
    expect(error).toContain('No section "gamma"')
    expect(error).toContain('- Beta')
  })

  // An agent holding a member name off jb.inspect, a search hit or a config
  // asks for it as a section. The name is the page's cheapest route and was the
  // one route that failed — on LinearAlignmentsDisplay the getter list is 48 KB.
  describe('a member name in place of a heading', () => {
    const page = `# Model

Summary.

## Actions

- \`setColor(color: string | Partial<Color>) => void\`: Replace the color object whole.
- \`setColorTag(tag: string) => void\`

## Getters

- \`rowHeight: number\`: What one row takes.
- \`index.indexType: stringEnum (BAI, CSI)\`
`

    it('answers with that bullet under the heading it sits in', () => {
      const { text } = readDocSection(page, 'rowHeight', { members: true })
      expect(text).toBe(
        '## Getters\n- `rowHeight: number`: What one row takes.\n',
      )
    })

    it('matches a name the way it matches a heading — the separators collapse', () => {
      expect(
        readDocSection(page, 'indexIndexType', { members: true }).text,
      ).toContain('stringEnum (BAI, CSI)')
    })

    // The whole point is not to answer with the section, so a name that is a
    // prefix of another must not silently widen to it — and on the real
    // alignments page `setColor` is a prefix of the legacy `setColorBy`.
    it('does not take setColorTag for setColor', () => {
      const { text } = readDocSection(page, 'setColor', { members: true })
      expect(text).toContain('Replace the color object whole.')
      expect(text).not.toContain('setColorTag')
    })

    it('answers a partial name with the near names, not their bullets', () => {
      const { error } = readDocSection(page, 'color', { members: true })
      expect(error).toContain('setColor, setColorTag')
      expect(error).not.toContain('Replace the color object whole.')
    })

    // A heading wins: `Getters` is a section and not a member, and a document
    // where a member shares a heading's name means the section.
    it('prefers a heading over a member of the same name', () => {
      expect(readDocSection(page, 'Getters', { members: true }).text).toContain(
        'rowHeight',
      )
    })

    // The hand-written topics do not opt in. Their bullets are prose, and the
    // fallback answered `section:"loc"` out of a fast-path recipe's bullet
    // instead of listing the sections the agent had guessed wrong at — which is
    // the whole value of a miss on a page with real headings.
    it('is off unless the caller asks, so a prose topic still lists its sections', () => {
      const { error, text } = readDocSection(page, 'rowHeight')
      expect(text).toBeUndefined()
      expect(error).toContain('No section "rowHeight"')
      expect(error).toContain('- Getters')
    })
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

// The real corpus, not a fixture: the shape that made the bare answer useless
// is the shape every generated page has, and a fixture page small enough to
// read whole never reaches the branch that drops the title.
describe('the biggest generated type page as the docs tool serves it', () => {
  const pages = JSON.parse(
    fs.readFileSync(`${__dirname}/docs/typeDocs.generated.json`, 'utf8'),
  ) as { models: Record<string, { text: string }> }
  const page = pages.models.LinearAlignmentsDisplay!.text
  const bare = () => readDocSection(page, '').text!

  it('orients before it offers: the composes line and the config route', () => {
    const text = bare()
    expect(text).toContain('# LinearAlignmentsDisplay')
    expect(text).toContain('Composes BaseDisplay')
    expect(text).toContain('docs topic "config:LinearAlignmentsDisplay"')
  })

  // The title's own section is the whole page, so offering it is offering
  // `section:"all"` under another name.
  it('offers the four member sections and not the page itself', () => {
    const text = bare()
    for (const heading of ['Actions', 'Getters', 'Properties', 'Methods']) {
      expect(text).toMatch(new RegExp(`- ${heading} \\(\\d+ chars\\)`))
    }
    expect(text).not.toMatch(/- LinearAlignmentsDisplay \(/)
  })

  it('costs a fraction of the page it describes', () => {
    expect(page.length).toBeGreaterThan(50_000)
    expect(bare().length).toBeLessThan(5000)
  })

  // The bullet shape the member route matches is the generator's, so pin it
  // against the generated page rather than only against a fixture of it.
  it('answers one member by name without the section holding it', () => {
    const { text } = readDocSection(page, 'setColor', { members: true })
    expect(text).toContain('## Actions')
    expect(text).toContain('`setColor(')
    expect(text!.length).toBeLessThan(500)
  })
})
