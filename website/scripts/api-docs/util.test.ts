import {
  categoryLabel,
  collectTransitive,
  elideSignature,
  exampleSection,
  filterUnseenByName,
  lastTaggedLine,
  markerBlockNames,
  overviewSection,
  parseTaggedComment,
  removeComments,
  replaceMarkerRegions,
  repoRelative,
  section,
  sortUnionMembers,
  stripComposedBlock,
  stripPropertyName,
} from './util.ts'

describe('lastTaggedLine', () => {
  test('reads the value after a tag heading a comment line', () => {
    expect(
      lastTaggedLine('// #reexport The base Plugin class', 'reexport'),
    ).toBe('The base Plugin class')
  })

  test('returns undefined when no line carries the tag', () => {
    expect(lastTaggedLine('// just an ordinary comment', 'reexport')).toBe(
      undefined,
    )
  })

  // The bug this helper exists for. The comment that documents the convention
  // sits directly above the first tagged entry, so it is part of that entry's
  // leading trivia — and a substring match took its sentence as the value,
  // rendering `@jbrowse/core/Plugin` as "<what it provides>` line,".
  test('ignores a tag mentioned mid-sentence rather than heading the line', () => {
    expect(
      lastTaggedLine(
        '// Each carries a `#reexport <what it provides>` line, which renders\n// the table in the guide.',
        'reexport',
      ),
    ).toBe(undefined)
  })

  test('takes the last tagged line, the one nearest the entry', () => {
    expect(
      lastTaggedLine(
        '// #autorun the viewport | refetch\n// #autorun regionTooLarge | clear hover',
        'autorun',
      ),
    ).toBe('regionTooLarge | clear hover')
  })

  // `#autorunSomething` is a different tag, not this one with a suffix.
  test('does not match a tag that is a prefix of a longer word', () => {
    expect(lastTaggedLine('// #autorunOptions foo', 'autorun')).toBe(undefined)
  })

  test('treats a tag with no value as absent rather than empty', () => {
    expect(lastTaggedLine('// #reexport', 'reexport')).toBe(undefined)
  })
})

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

  test('ignores a tag mentioned mid-prose rather than heading the line', () => {
    const { category, docs } = parseTaggedComment(
      '#stateModel Foo\n#category general\nnot a view, which the #category tag overrides',
      'stateModel',
      'Foo',
    )
    expect(category).toBe('general')
    expect(docs).toBe('not a view, which the #category tag overrides')
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

describe('filterUnseenByName', () => {
  test('keeps items not yet seen and adds them to the set', () => {
    const seen = new Set<string>()
    const kept = filterUnseenByName(seen, [{ name: 'a' }, { name: 'b' }])
    expect(kept.map(i => i.name)).toEqual(['a', 'b'])
    expect(seen).toEqual(new Set(['a', 'b']))
  })

  test('drops an item whose name is already seen', () => {
    const seen = new Set(['a'])
    const kept = filterUnseenByName(seen, [{ name: 'a' }, { name: 'b' }])
    expect(kept.map(i => i.name)).toEqual(['b'])
  })

  test('across two calls sharing one set, a name is kept only the first time', () => {
    // mirrors walking a base chain closest-first: a slot a closer base already
    // showed must not resurface from a farther one
    const seen = new Set<string>()
    const closer = filterUnseenByName(seen, [{ name: 'featureHeight' }])
    const farther = filterUnseenByName(seen, [{ name: 'featureHeight' }])
    expect(closer.map(i => i.name)).toEqual(['featureHeight'])
    expect(farther).toEqual([])
  })
})

describe('replaceMarkerRegions', () => {
  const splice = (text: string, block = 'BODY') =>
    replaceMarkerRegions({
      text,
      startMarker: '<!-- T START -->',
      endMarker: '<!-- T END -->',
      block,
      file: 'doc.md',
    })

  test('rewrites the region between a pair', () => {
    expect(splice('a\n<!-- T START -->\n\nold\n\n<!-- T END -->\nb')).toBe(
      'a\n<!-- T START -->\n\nBODY\n\n<!-- T END -->\nb',
    )
  })

  test('rewrites EVERY pair, not just the first', () => {
    // A non-global replace left the second block on the previous run's content
    // forever, and `--check` could not see it: the text it compares is the same
    // whether or not that block was regenerated.
    const doc = [
      '<!-- T START -->\n\nBODY\n\n<!-- T END -->',
      '<!-- T START -->\n\nstale\n\n<!-- T END -->',
    ].join('\n\nprose\n\n')
    expect(splice(doc)).not.toContain('stale')
  })

  test('leaves a doc with no marker alone', () => {
    expect(splice('nothing to see')).toBe('nothing to see')
  })

  test('throws on a START with no matching END', () => {
    // Silently a no-op before: the doc rendered nothing between the markers and
    // the generator still reported it up to date.
    expect(() => splice('<!-- T START -->\n\nold\n')).toThrow(
      /no matching .*T END/,
    )
  })

  test('throws on a second START before the END closes the first', () => {
    expect(() =>
      splice('<!-- T START -->\n<!-- T START -->\n<!-- T END -->'),
    ).toThrow(/no matching/)
  })

  test('keeps a $-sequence in the rendered block literal', () => {
    expect(splice('<!-- T START -->\n<!-- T END -->', "$' and $&")).toContain(
      "$' and $&",
    )
  })
})

describe('repoRelative', () => {
  test('strips the repo-root prefix', () => {
    expect(repoRelative(`${process.cwd()}/plugins/foo/src/x.ts`)).toBe(
      'plugins/foo/src/x.ts',
    )
  })
})

// The checker orders a union its own way, and that order moves with the
// composition of the program, so a doc nobody touched fails `autogen --check`.
describe('sortUnionMembers', () => {
  test('sorts a bare literal union', () => {
    expect(sortUnionMembers('"none" | "overlay" | "below"')).toBe(
      '"below" | "none" | "overlay"',
    )
  })

  // the case 161d06e858 measured and left: the union is a parameter's type, so
  // `setting: ` prefixes the first member and must stay attached to it
  test('sorts a union nested in a parameter list, keeping the parameter name', () => {
    expect(
      sortUnionMembers(
        '(setting: "overlapping" | "offset" | "hidden") => void',
      ),
    ).toBe('(setting: "hidden" | "offset" | "overlapping") => void')
  })

  test('sorts a union nested in an object type', () => {
    expect(
      sortUnionMembers(
        '{ readConnections: "off" | "arc" | "cloud"; n: number }',
      ),
    ).toBe('{ readConnections: "arc" | "cloud" | "off"; n: number }')
  })

  // leaving a non-literal alternative where it is keeps the shape in front of
  // the elided preview, which is the readable half of `{ … } | undefined`
  test('leaves a union of non-literals alone', () => {
    const sig = '{ type?: string; effectiveRpcDriverName?: string } | undefined'
    expect(sortUnionMembers(sig)).toBe(sig)
  })

  test('sorts only the literal run inside a mixed union', () => {
    expect(sortUnionMembers('"b" | "a" | undefined')).toBe(
      '"a" | "b" | undefined',
    )
  })

  test('leaves a lone literal alone', () => {
    expect(sortUnionMembers('"only"')).toBe('"only"')
  })

  test('does not split on a pipe inside a literal', () => {
    expect(sortUnionMembers('"a|b"')).toBe('"a|b"')
  })
})

describe('elideSignature', () => {
  test('leaves a short signature alone', () => {
    expect(elideSignature('(x: number) => boolean')).toBe(
      '(x: number) => boolean',
    )
  })

  test('collapses generic arguments from the inside out', () => {
    const sig = `IConfigurationReference<ConfigurationSchemaType<{ readonly featureHeight: { readonly type: "maybeNumber"; readonly description: "${'x'.repeat(200)}" } }>>`
    expect(elideSignature(sig)).toBe(
      'IConfigurationReference<ConfigurationSchemaType<…>>',
    )
  })

  test('collapses only as far as it has to, keeping the outer shape', () => {
    const sig = `(config: ModelInstanceTypeProps<Record<string, ${'a'.repeat(200)}>>) => void`
    expect(elideSignature(sig)).toBe(
      '(config: ModelInstanceTypeProps<Record<…>>) => void',
    )
  })

  test('does not mistake the > of => for a closing bracket', () => {
    const sig = `Array<(cb: ${'b'.repeat(200)}) => void>`
    expect(elideSignature(sig)).toBe('Array<…>')
  })

  test('drops trailing alternatives of a long union with no generics', () => {
    const sig = ['Alpha', 'Beta', 'Gamma', 'Delta']
      .map(n => n.repeat(20))
      .join(' | ')
    const out = elideSignature(sig)
    expect(out.endsWith(' | …')).toBe(true)
    expect(out.startsWith('Alpha'.repeat(20))).toBe(true)
  })

  test('collapses an inline object type once generics are exhausted', () => {
    const sig = `(entries: string[], id: string, strand: number | undefined, readName: string | undefined, normalize?: boolean | undefined) => { refName: string; start: number; ${'x'.repeat(100)}: number }[]`
    // the union inside a parameter is not a top-level union, so the return type
    // survives — truncating by width used to eat it
    expect(elideSignature(sig)).toBe(
      '(entries: string[], id: string, strand: number | undefined, readName: string | undefined, normalize?: boolean | undefined) => {…}[]',
    )
  })

  test('leaves a type it cannot shorten structurally alone', () => {
    expect(elideSignature('z'.repeat(300))).toBe('z'.repeat(300))
  })
})

describe('markerBlockNames', () => {
  test('finds a plain and a grouped block, the group under its base name', () => {
    expect(
      markerBlockNames(
        '<!-- JEXL_CATALOG START -->\n\n<!-- JEXL_CATALOG END -->\n<!-- COLOR_TABLE alignments-indicators START -->',
      ),
    ).toEqual(['JEXL_CATALOG', 'COLOR_TABLE'])
  })

  test('ignores a marker named inside a sentence', () => {
    // ARCHITECTURE.md documents the convention by naming the pair in prose.
    // CommonMark reads an HTML comment mid-paragraph as inline text, so nothing
    // is spliced there and counting it would report a block no generator owes.
    expect(
      markerBlockNames("Don't hand-edit between a `<!-- NAME START -->` pair"),
    ).toEqual([])
  })

  test('ignores an END, and a START carrying trailing text', () => {
    expect(
      markerBlockNames('<!-- JEXL_CATALOG END -->\n<!-- X START --> and more'),
    ).toEqual([])
  })
})
