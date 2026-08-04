// Flags a UI menu path written with anything but the corpus separator, `→`.
//
// A menu path is prose that walks a reader through the app: **Color by... →
// Paired end → First of pair strand**. 20 files spell that with `→` and a
// handful had drifted to `>`, `▸`, `->` and the `&rarr;` entity, sometimes
// inside backticks instead of bold. Nothing enforced it, and the spelling is
// invisible to a reader of any single page, so drift only surfaces when someone
// greps the whole corpus.
//
// Unlike the caption check this is a hard failure, not a ratchet: there is no
// legitimate reason to spell a menu path a second way, and the sweep that added
// this check left zero exceptions behind.
//
// Two shapes, because the separator lands in two places:
//   BETWEEN two spans   `Launch view` -> `Linear read vs ref`
//   INSIDE one span     **Show... > Show coverage**
//
// The inside-one-span form is restricted to **bold**, never backticks, which is
// what keeps jexl comparisons (`feature.score > 7.3`) and shell redirects
// (`minimap2 ref.fa query.fa > out.paf`) from tripping it — both are a single
// code span holding a `>` that has nothing to do with a menu. Fenced blocks are
// skipped outright for the same reason.
//
// A line that trips this on purpose can suppress it with `<!-- menu-path-ok -->`
// on the same line, matching check-wiki-titles.ts.
//
// Run: `pnpm check-menu-paths`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems, walkFiles } from './check-utils.ts'

const docsDir = join(import.meta.dirname, '..', 'docs')
const GENERATED_PREFIXES = ['config/', 'models/', 'api/']
const SUPPRESS = '<!-- menu-path-ok -->'

const SPAN = String.raw`(?:\*\*[^*]+\*\*|\`[^\`]+\`)`
const RULES = [
  {
    // `Launch view` -> `Linear read vs ref`, **About ▸ Copy config** split
    // across two bold runs, and so on.
    re: new RegExp(String.raw`${SPAN}\s*(?:->|>|▸)\s*${SPAN}`),
    what: 'menu path between two labels',
  },
  {
    // **Show... > Show coverage**. Bold only — see the note above.
    re: /\*\*[^*]*\s(?:->|>|▸)\s[^*]*\*\*/,
    what: 'menu path inside one bold label',
  },
  {
    // No prose use of either; `&rarr;` is the HTML entity for the same arrow.
    re: /&rarr;|▸/,
    what: 'HTML-entity or non-standard arrow',
  },
]

const errorLines: string[] = []
for (const file of walkFiles(
  docsDir,
  name => name.endsWith('.md') && name !== 'CLAUDE.md',
)) {
  const rel = file.slice(docsDir.length + 1)
  if (GENERATED_PREFIXES.some(p => rel.startsWith(p))) {
    continue
  }
  let inFence = false
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.startsWith('```')) {
        inFence = !inFence
        return
      }
      if (inFence || line.includes(SUPPRESS)) {
        return
      }
      const rule = RULES.find(r => r.re.test(line))
      if (rule) {
        errorLines.push(
          `  ${rel}:${i + 1} (${rule.what})\n      ${line.trim()}`,
        )
      }
    })
}

reportProblems(
  errorLines.length > 0
    ? [
        `Found ${errorLines.length} menu path(s) not using the \`→\` separator:\n`,
        ...errorLines,
        `\nWrite menu paths as **A → B → C**. Add ${SUPPRESS} to the line if a`,
        `match is genuinely not a menu path.`,
      ]
    : [],
  'All menu paths use the → separator.',
)
