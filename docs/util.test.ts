import {
  categoryLabel,
  collapsible,
  collapsibleClosed,
  collectTransitive,
  exampleSection,
  overviewSection,
  parseTaggedComment,
  removeComments,
  repoRelative,
  section,
  stripComposedBlock,
  stripPropertyName,
} from './util.ts'

describe('parseTaggedComment', () => {
  test('reads the name after the tag and keeps prose as docs', () => {
    const { name, docs, category, examples } = parseTaggedComment(
      '#config BamAdapter\nUsed to configure a BAM',
      'config',
      'Fallback',
    )
    expect(name).toBe('BamAdapter')
    expect(docs).toBe('Used to configure a BAM')
    expect(category).toBeUndefined()
    expect(examples).toEqual([])
  })

  test('falls back to the provided name when the tag carries none', () => {
    expect(
      parseTaggedComment('#config\nprose', 'config', 'Fallback').name,
    ).toBe('Fallback')
  })

  test('extracts a #category and removes it from docs', () => {
    const { category, docs } = parseTaggedComment(
      '#stateModel Foo\n#category session\nthe description',
      'stateModel',
      'Foo',
    )
    expect(category).toBe('session')
    expect(docs).toBe('the description')
  })

  test('extracts a #trackType and removes it from docs', () => {
    const { trackType, docs } = parseTaggedComment(
      '#config BamAdapter\n#trackType AlignmentsTrack\nthe description',
      'config',
      'BamAdapter',
    )
    expect(trackType).toBe('AlignmentsTrack')
    expect(docs).toBe('the description')
  })

  test('collects multiple labeled examples in order', () => {
    const { examples } = parseTaggedComment(
      '#config Foo\nprose\n#example minimal\ncode A\n#example full\ncode B',
      'config',
      'Foo',
    )
    expect(examples).toEqual([
      { label: 'minimal', content: 'code A' },
      { label: 'full', content: 'code B' },
    ])
  })

  test('does not treat a longer word as the tag (word boundary)', () => {
    // "#configuration" must not be parsed as a "#config" name line
    const { name, docs } = parseTaggedComment(
      '#config Foo\nsee #configuration notes',
      'config',
      'Foo',
    )
    expect(name).toBe('Foo')
    expect(docs).toBe('see #configuration notes')
  })
})

describe('categoryLabel', () => {
  test('splits camelCase and capitalizes', () => {
    expect(categoryLabel('assemblyManagement')).toBe('Assembly Management')
    expect(categoryLabel('session')).toBe('Session')
  })
})

describe('removeComments', () => {
  test('strips comments but preserves // inside string literals', () => {
    expect(removeComments('const x = 1 // trailing')).toBe('const x = 1')
    expect(removeComments("const u = 'http://example.com'")).toBe(
      "const u = 'http://example.com'",
    )
  })
})

describe('stripPropertyName', () => {
  test('drops the slot-name prefix and keeps just the value', () => {
    expect(
      stripPropertyName("theme: { type: 'frozen', defaultValue: {} }"),
    ).toBe("{ type: 'frozen', defaultValue: {} }")
  })

  test('ignores colons inside the value (URLs, nested objects, string keys)', () => {
    expect(
      stripPropertyName("uri: { value: 'http://example.com', a: { b: 1 } }"),
    ).toBe("{ value: 'http://example.com', a: { b: 1 } }")
    expect(stripPropertyName("'a: b': { type: 'string' }")).toBe(
      "{ type: 'string' }",
    )
  })

  test('re-flushes multi-line values so the closing brace aligns at column 0', () => {
    const code = `bamLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bam',
      },
    }`
    expect(stripPropertyName(code)).toBe(`{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bam',
  },
}`)
  })

  test('returns the value unchanged when there is no top-level colon', () => {
    expect(stripPropertyName("{ type: 'string' }")).toBe("{ type: 'string' }")
  })
})

describe('section / overviewSection', () => {
  test('joins truthy parts with blank lines and drops falsy ones', () => {
    expect(section('a', '', false, 0, undefined, 'b')).toBe('a\n\nb')
  })

  test('overviewSection is empty when there is no content', () => {
    expect(overviewSection('', false)).toBe('')
  })

  test('overviewSection adds the heading only when the body has sections', () => {
    expect(overviewSection('prose', '## Slots\n\n...')).toBe(
      '## Overview\n\nprose\n\n## Slots\n\n...',
    )
    expect(overviewSection('prose', '<details>\n<summary>x</summary>')).toBe(
      '## Overview\n\nprose\n\n<details>\n<summary>x</summary>',
    )
  })

  test('overviewSection emits bare prose when there are no sub-sections', () => {
    expect(overviewSection('just a one-line description')).toBe(
      'just a one-line description',
    )
  })

  test('collapsible wraps content with blank lines so inner markdown renders', () => {
    expect(collapsible('Title', '#### a', '#### b')).toBe(
      '<details open>\n<summary>Title</summary>\n\n#### a\n\n#### b\n\n</details>',
    )
    expect(collapsible('Title', '', false, undefined)).toBe('')
  })

  test('collapsibleClosed omits the open attribute', () => {
    expect(collapsibleClosed('Title', 'body')).toBe(
      '<details>\n<summary>Title</summary>\n\nbody\n\n</details>',
    )
    expect(collapsibleClosed('Title', '', false)).toBe('')
  })
})

describe('exampleSection', () => {
  test('is empty when there are no examples', () => {
    expect(exampleSection([])).toBe('')
  })

  test('uses a heading and nests labeled sub-examples', () => {
    const out = exampleSection(
      [{ label: 'minimal', content: 'code' }],
      '## Example usage',
    )
    expect(out).toContain('## Example usage')
    expect(out).toContain('### Example: minimal')
    expect(out).toContain('code')
  })
})

describe('stripComposedBlock', () => {
  test('removes an extends block but keeps later column-0 prose', () => {
    const input = 'Some description\nextends\n- Base\n- Mixin\nmore prose'
    expect(stripComposedBlock(input)).toBe('Some description\nmore prose')
  })
})

describe('collectTransitive', () => {
  interface Node {
    id: string
    parents: string[]
  }
  const graph: Record<string, Node> = {
    a: { id: 'a', parents: ['b', 'c'] },
    b: { id: 'b', parents: ['d'] },
    c: { id: 'c', parents: ['d'] },
    d: { id: 'd', parents: [] },
  }
  const walk = (root: Node) =>
    collectTransitive(
      root,
      n => n.id,
      n => n.parents.map(p => graph[p]!),
    ).map(n => n.id)

  test('returns parents depth-first, deduped, in reading order', () => {
    // a -> b -> d, then c (d already seen and skipped)
    expect(walk(graph.a!)).toEqual(['b', 'd', 'c'])
  })

  test('guards cycles (terminates; root may reappear once via the cycle)', () => {
    const cyclic: Record<string, Node> = {
      x: { id: 'x', parents: ['y'] },
      y: { id: 'y', parents: ['x'] },
    }
    // x -> y -> x, then x's parent y is already seen and stops. The root is not
    // pre-seeded into the visited set, so it reappears once; the dedup still
    // guarantees termination (matches the original collectAncestors behavior).
    expect(
      collectTransitive(
        cyclic.x!,
        n => n.id,
        n => n.parents.map(p => cyclic[p]!),
      ).map(n => n.id),
    ).toEqual(['y', 'x'])
  })
})

describe('repoRelative', () => {
  test('strips the repo-root prefix', () => {
    expect(repoRelative(`${process.cwd()}/plugins/foo/src/x.ts`)).toBe(
      'plugins/foo/src/x.ts',
    )
  })
})
