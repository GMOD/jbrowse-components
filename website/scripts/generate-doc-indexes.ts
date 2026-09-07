// Generates the index of each agent-docs directory that is a flat pile of docs
// — `reference/`, `ideas/`, `mechanisms/` and `handoffs/` — from the docs' own
// frontmatter, so
// a directory can be scanned in one read instead of fifty. The list is INDEXES
// below; add a directory there and give it a README with the marker pair.
//
// agent-docs/CLAUDE.md already makes the rule: every doc outside
// architecture-decision-records/ carries `name:` / `description:` frontmatter,
// and "`ls` a directory and read the descriptions — that is how you find the
// right doc without opening all of them, so a new doc without one is
// invisible." That was a convention nothing enforced, and following it required
// opening every file to read one line out of each. This does both jobs: it
// renders the descriptions into one page, and it fails when a doc is missing
// the frontmatter that would put it there.
//
// It does not rank, and it groups only where the grouping is already a field
// every doc carries and something else already checks. The ADR index sorts by
// number because ADRs are numbered; these have no such order, and a grouping
// invented here would be a hand-maintained judgement — the exact thing this is
// replacing. `reference/` splits on `audience:`, which is neither invented nor
// hand-maintained: it is the decision `check-reference-citations.ts` enforces
// (an internal doc needs no website link, a citeable one does), so the two
// tables cannot drift away from the checker's idea of which doc is which. That
// directory reached 79 docs in one alphabetical table where half the rows are a
// figure harness, a CI gate or an audit and the other half are behaviour a
// reader can hit, and nothing on the page said so. Within a table, alphabetical,
// matching `ls`.
//
// `ideas/` joined in 2026-08 when OTHER_IDEAS.md was exploded into one file per
// proposal. Its hand-maintained 104-line index was the very shape agent-docs
// /CLAUDE.md warns about ("a list some author transcribed once and no one
// re-derived"), and generating it was the point of the split as much as the
// per-idea files were.
//
// Only the block between the markers is generated; the prose above it is
// hand-maintained. Run: `pnpm autogen` (or `--check` in CI).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  checkOrWrite,
  markdownTableLines,
  parseFrontmatter,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

// The index is the one file in each of these directories that isn't a doc in
// its own right, so it does not list itself.
const SELF = 'README.md'

// `reference/` groups on `kind:`, which is what a reader picking a doc for a
// task needs to know first: a subsystem spec, a measurement record, the data
// behind a figure, or how to operate a harness. `audience: internal` is the
// separate decision `check-reference-citations.ts` enforces (an internal doc
// needs no website link) and is shown per row rather than as a table, so the
// two fields stay two fields.
const KIND_GROUPS = [
  ['spec', 'Specs: how a subsystem works'],
  ['measurement', 'Measurements: numbers taken, and what they settled'],
  ['dataset', 'Datasets: the data behind the demos, figures and tutorials'],
  ['operations', 'Operations: harnesses, gates and toolchain'],
].map(([kind, title]) => ({
  title: title!,
  match: (doc: Doc) => doc.kind === kind,
}))

// A description is the row a reader picks a doc by, and the index is read
// whole; past this it is an abstract, and the abstract belongs in the doc's
// first paragraph.
const MAX_DESCRIPTION_WORDS = 45

const AREA_GROUPS = [
  ['rendering-and-displays', 'Rendering and displays'],
  ['config-and-mst', 'Config and MST'],
  ['performance-and-measurement', 'Performance and measurement'],
  ['comparative-and-pangenome', 'Comparative and pangenome'],
  ['data-and-demos', 'Data and demos'],
  [
    'figures-that-were-attempted-and-cannot-be-made',
    'Figures that were attempted and cannot be made',
  ],
  ['tooling-tests-and-docs', 'Tooling, tests and docs'],
].map(([area, title]) => ({
  title: title!,
  match: (doc: Doc) => doc.area === area,
}))

const INDEXES = [
  {
    dir: 'reference',
    marker: 'REFERENCE INDEX',
    label: 'Reference index',
    heading: 'Read when',
    groups: KIND_GROUPS,
    maxDescriptionWords: MAX_DESCRIPTION_WORDS,
  },
  {
    dir: 'ideas',
    marker: 'IDEAS INDEX',
    label: 'Ideas index',
    // Not "Read when": these are proposals to pick up, and the description is
    // written as the hook you pick one up by.
    heading: 'What it covers',
  },
  {
    // The distilled technique statements. Newest of the four directories and
    // the only one whose filenames are checked against the frontmatter slug:
    // `reference/` spells a doc two ways (SCREAMING_SNAKE file, kebab `name:`)
    // and every citation has to know which context it is in. Here they are one
    // string.
    dir: 'mechanisms',
    marker: 'MECHANISMS INDEX',
    label: 'Mechanisms index',
    // Not "Read when": a mechanism is looked up by the idea it carries, by
    // someone who may not know which subsystem demonstrates it.
    heading: 'The idea it carries',
    slugFilenames: true,
  },
  {
    // One file per declined idea, grouped by the `area:` each carries; an area
    // outside AREA_GROUPS is an error, so a typo cannot drop an entry from the
    // page.
    dir: 'rejected-ideas',
    marker: 'REJECTED IDEAS INDEX',
    label: 'Rejected ideas index',
    heading: 'The idea',
    slugFilenames: true,
    groups: AREA_GROUPS,
  },
  {
    // `handoffs/` was the one directory here you had to `ls`, which is the
    // state agent-docs/CLAUDE.md tells everyone else not to be in. It is also
    // the directory that most needs the discipline: a handoff's subject is
    // still moving, so it goes stale faster than anything in reference/, and
    // seven of the eight that existed on 2026-08-19 closed in a day.
    dir: 'handoffs',
    marker: 'HANDOFFS INDEX',
    label: 'Handoffs index',
    heading: 'What it is waiting on',
  },
]

interface Doc {
  file: string
  name: string
  description: string
  audience: string | undefined
  area: string | undefined
  kind: string | undefined
}

function collectDocs(
  dir: string,
  slugFilenames = false,
  maxDescriptionWords?: number,
): Doc[] {
  const docsDir = join(repoRoot, 'agent-docs', dir)
  const docs: Doc[] = []
  const unindexable: string[] = []
  for (const file of readdirSync(docsDir)) {
    if (!file.endsWith('.md') || file === SELF) {
      continue
    }
    // `description` is prose and routinely wraps across lines in these files;
    // parseFrontmatter re-flows a wrapped value onto one line for the cell.
    const fm = parseFrontmatter(readFileSync(join(docsDir, file), 'utf8'))
    if (!fm) {
      throw new Error(
        `agent-docs/${dir}/${file}: no frontmatter. Every doc here needs \`name:\` and \`description:\` — without them it is invisible to anyone scanning the directory (see agent-docs/CLAUDE.md)`,
      )
    }
    const name = fm.name?.trim()
    const description = fm.description?.trim().replaceAll(/\s+/g, ' ')
    if (!name || !description) {
      unindexable.push(`${file} (needs ${!name ? 'name' : 'description'})`)
    } else if (slugFilenames && file !== `${name}.md`) {
      unindexable.push(
        `${file} (\`name: ${name}\` wants the filename ${name}.md)`,
      )
    } else if (
      maxDescriptionWords !== undefined &&
      description.split(' ').length > maxDescriptionWords
    ) {
      unindexable.push(
        `${file} (description is ${description.split(' ').length} words, over ${maxDescriptionWords}: keep the row to what a reader picks the doc by and move the rest into its first paragraph)`,
      )
    } else {
      docs.push({
        file,
        name,
        description,
        audience: fm.audience?.trim(),
        area: fm.area?.trim(),
        kind: fm.kind?.trim(),
      })
    }
  }
  if (unindexable.length) {
    throw new Error(
      `${unindexable.length} doc(s) in agent-docs/${dir}/ cannot be indexed, so they would be invisible to a directory scan:\n${unindexable
        .map(m => `  ${m}`)
        .join('\n')}`,
    )
  }
  return docs.sort((a, b) => a.file.localeCompare(b.file))
}

const tableFor = (docs: Doc[], heading: string) =>
  markdownTableLines(
    ['Doc', heading],
    docs.map(
      d =>
        `| [${d.name}](${d.file})${d.audience === 'internal' ? ' (internal)' : ''} | ${d.description} |`,
    ),
  )

for (const {
  dir,
  marker,
  label,
  heading,
  slugFilenames,
  groups,
  maxDescriptionWords,
} of INDEXES) {
  const indexPath = join(repoRoot, 'agent-docs', dir, SELF)
  const docs = collectDocs(dir, slugFilenames, maxDescriptionWords)
  const filled = groups?.filter(g => docs.some(g.match))
  const ungrouped = groups
    ? docs.filter(d => !groups.some(g => g.match(d)))
    : []
  if (ungrouped.length) {
    throw new Error(
      `agent-docs/${dir}/: ${ungrouped.map(d => d.file).join(', ')} match no group of the index, so they would be invisible on it. Each needs the frontmatter field the groups split on (\`kind:\` in reference/, \`area:\` in rejected-ideas/), set to one of the values in website/scripts/generate-doc-indexes.ts`,
    )
  }
  checkOrWrite({
    path: indexPath,
    content: spliceGeneratedBlock({
      path: indexPath,
      marker,
      body: filled
        ? filled.flatMap((group, i) => [
            ...(i ? [''] : []),
            `## ${group.title}`,
            '',
            ...tableFor(docs.filter(group.match), heading),
          ])
        : tableFor(docs, heading),
    }),
    label,
    staleHint: 'run `pnpm autogen`',
  })
}
