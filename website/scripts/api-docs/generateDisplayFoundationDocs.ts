import { composeCalls, markdownTable, rewriteMarkerBlock } from './util.ts'

import type { SourceCorpus } from './util.ts'

// Render the display-foundations table into the hand-written creating_display
// guide from the source itself, so the "used by" column can't drift. It already
// did once: the guide claimed a `RegionTooLargeMixin` foundation used by the arc
// and circular-chord displays, when arc composes `GlobalFetchMixin`,
// `RegionTooLargeMixin` is never composed directly by a display, and the chord
// display isn't an LGV display at all.
//
// Two tags, both on the JSDoc block that already carries `#stateModel`:
//
//   the foundation mixin  /** #stateModel MultiRegionDisplayMixin
//                             #displayFoundationDef <what it brings> */
//   each display using it /** #stateModel LinearWiggleDisplay
//                             #displayFoundation MultiRegionDisplayMixin */
//
// A new display joins the table by tagging itself; nothing is restated, since
// the display's own name comes from the `#stateModel` tag above it.
//
// Two markers, both regenerated on `pnpm autogen`, over the same collected data:
//
//   <!-- DISPLAY_FOUNDATIONS START -->        the public guide's table
//   <!-- DISPLAY_FOUNDATION_STACKS START -->  the architecture spec's
//
// They differ in one column. The guide says what a foundation brings as prose
// (the `#displayFoundationDef` tag); the spec names the mixins it composes,
// which is read straight off the foundation's own `types.compose(...)` call and
// so needs no tag at all. The spec used to carry the display list as a
// hand-maintained mirror of the guide's, under an explicit "then mirror it
// here" instruction — which is a drift axis written down as a procedure.
//
// Editing between the markers is pointless — it is overwritten on regen.

// `#stateModel <Name>` followed, within the same JSDoc, by one of the two tags.
// The `[^*]*(?:\*(?!/)[^*]*)*?` run walks comment body without escaping the
// block, so a tag can't be picked up from the next JSDoc down the file.
const DEF =
  /#stateModel\s+(\w+)[^*]*(?:\*(?!\/)[^*]*)*?#displayFoundationDef\s+([^\n*]+)/g
const USE =
  /#stateModel\s+(\w+)[^*]*(?:\*(?!\/)[^*]*)*?#displayFoundation\s+(\w+)/g

interface Foundation {
  name: string
  brings: string
  composes: string[]
  displays: string[]
}

// The mixins a foundation composes, read off its own
// `types.compose('<name>', A(), B(), types.model({}))` call.
//
// Structural, deliberately: this is the one column the architecture spec kept by
// hand, and it is a restatement of a call three lines below the tag.
function composedMixins(corpus: SourceCorpus, file: string, name: string) {
  return composeCalls(file, corpus.read(file))
    .filter(call => call.name === name)
    .flatMap(call => call.mixins)
}

export function collectFoundations(corpus: SourceCorpus) {
  const defs = new Map<string, string>()
  const defFiles = new Map<string, string>()
  const uses = new Map<string, string[]>()
  for (const file of corpus.files) {
    const src = corpus.read(file)
    if (!src.includes('#displayFoundation')) {
      continue
    }
    for (const [, name, brings] of src.matchAll(DEF)) {
      defs.set(name!, brings!.trim())
      defFiles.set(name!, file)
    }
    for (const [, model, foundation] of src.matchAll(USE)) {
      uses.set(foundation!, [...(uses.get(foundation!) ?? []), model!])
    }
  }
  for (const foundation of uses.keys()) {
    if (!defs.has(foundation)) {
      throw new Error(
        `#displayFoundation ${foundation} has no #displayFoundationDef on the mixin itself`,
      )
    }
  }
  const foundations: Foundation[] = [...defs].map(([name, brings]) => ({
    name,
    brings,
    composes: composedMixins(corpus, defFiles.get(name)!, name),
    displays: [...(uses.get(name) ?? [])].sort((a, b) => a.localeCompare(b)),
  }))
  // Most-used first, so the common case leads; name breaks ties for stability.
  return foundations.sort(
    (a, b) =>
      b.displays.length - a.displays.length || a.name.localeCompare(b.name),
  )
}

const code = (names: string[]) => names.map(n => `\`${n}\``).join(', ')

function renderTable(foundations: Foundation[]) {
  return markdownTable(
    ['Foundation', 'Brings', 'Used by'],
    foundations.map(
      f => `| \`${f.name}()\` | ${f.brings} | ${code(f.displays)} |`,
    ),
  )
}

// The architecture spec's variant: composed mixins in place of the prose, since
// what a reader touching a mixin needs is which other mixins arrive with it.
function renderStackTable(foundations: Foundation[]) {
  return markdownTable(
    ['Foundation (composed on `BaseDisplay`)', 'Composes', 'Displays'],
    foundations.map(
      f => `| \`${f.name}()\` | ${code(f.composes)} | ${code(f.displays)} |`,
    ),
  )
}

export function writeDisplayFoundationDocs(
  corpus: SourceCorpus,
  { check = false } = {},
) {
  const foundations = collectFoundations(corpus)
  return [
    ...rewriteMarkerBlock('DISPLAY_FOUNDATIONS', renderTable(foundations), {
      check,
    }),
    ...rewriteMarkerBlock(
      'DISPLAY_FOUNDATION_STACKS',
      renderStackTable(foundations),
      { check },
    ),
  ]
}
