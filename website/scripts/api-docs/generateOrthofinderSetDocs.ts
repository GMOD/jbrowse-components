import fs from 'fs'

import {
  codeCell,
  markdownTable,
  rewriteMarkerBlock,
  tableCell,
} from './util.ts'

// The three species sets `build_orthofinder_synteny.sh` knows, and the two cuts
// it makes, rendered into the OrthoFinder tutorial from the script itself.
//
// The page used to state all of this in prose: "the script keeps 30 sequences
// per genome", "a five-genome set is 25 DIAMOND runs and wheat's six is 36",
// "Six wheat-lineage genomes". Every one of those is a value the script owns,
// and the page had no way to notice the script changing — the same shape as
// restating a config slot's default, which the docs guide already forbids.
//
// The DIAMOND count is the one worth generating rather than dropping: it is the
// cost of a run, it is what a reader budgets against, and it is n^2 in a number
// the script decides. Computing it here means adding a genome to a set updates
// the page's estimate in the same commit.
const FILE = 'scripts/build_orthofinder_synteny.sh'

// The environment variables the tutorial documents, with the sentence the page
// needs about each. The default comes from the script; the description is here
// because the script's own comment is prose written for a different reader.
const CUTS = [
  {
    name: 'MAXSEQ',
    cuts: 'sequence regions kept per genome, the ones carrying the most genes',
  },
  {
    name: 'MAXCOPIES',
    cuts: 'genes in one orthogroup cell past which it is a gene family rather than a set of copies',
  },
]

export interface OrthofinderSet {
  /** the `$1` a reader passes to the script */
  name: string
  /** short names, which are also the JBrowse assembly names, in row order */
  genomes: string[]
  /** the Ensembl division and release the set is pinned to */
  release: string
}

export function collectOrthofinderSets(): OrthofinderSet[] {
  const text = fs.readFileSync(FILE, 'utf8')
  const sets: OrthofinderSet[] = []

  // `<name>)` … `BASE=<url>` … `REL=<n>` … `SPECIES=$(cat <<'EOF' … EOF`, which
  // is the shape every branch of the script's `case "$SET" in` has.
  const branch =
    /^(\w+)\)$[\s\S]*?BASE=(\S+)[\s\S]*?REL=(\S+)[\s\S]*?SPECIES=\$\(cat <<'EOF'\n([\s\S]*?)\nEOF/gm
  for (const m of text.matchAll(branch)) {
    const genomes = m[4]!
      .split('\n')
      .map(line => line.trim().split(/\s+/)[0]!)
      .filter(Boolean)
    if (!genomes.length) {
      throw new Error(
        `${FILE}: species set '${m[1]}' parsed to no genomes, so the tutorial's set table would render an empty row`,
      )
    }
    // The plant and metazoa sets come from Ensembl Genomes, whose release
    // numbering is its own: a bare "63" beside vertebrates' "113" reads as an
    // older Ensembl.
    const division = m[2]!.includes('/plants/')
      ? 'Ensembl Plants'
      : m[2]!.includes('/metazoa/')
        ? 'Ensembl Metazoa'
        : 'Ensembl'
    sets.push({ name: m[1]!, genomes, release: `${division} ${m[3]!}` })
  }

  if (!sets.length) {
    throw new Error(
      `${FILE}: no \`<set>)\` branch with a SPECIES heredoc, which is where the tutorial's set table comes from`,
    )
  }
  return sets
}

export function collectOrthofinderCuts() {
  const text = fs.readFileSync(FILE, 'utf8')
  return CUTS.map(cut => {
    // `MAXSEQ="${MAXSEQ:-30}"`
    const m = new RegExp(`${cut.name}="\\$\\{${cut.name}:-([^}]+)\\}"`).exec(
      text,
    )
    if (!m) {
      throw new Error(
        `${FILE}: no default for ${cut.name}, which the tutorial documents as one of the two cuts the script makes`,
      )
    }
    return { ...cut, default: m[1]! }
  })
}

export function writeOrthofinderSetDocs({ check = false } = {}) {
  const sets = collectOrthofinderSets()
  return [
    ...rewriteMarkerBlock(
      'ORTHOFINDER_SETS',
      markdownTable(
        ['Set', 'Genomes', 'DIAMOND runs', 'Annotation source'],
        sets.map(
          s =>
            `| ${codeCell(s.name)} | ${tableCell(s.genomes.join(', '))} | ${s.genomes.length ** 2} | ${tableCell(s.release)} |`,
        ),
      ),
      { check },
    ),
    ...rewriteMarkerBlock(
      'ORTHOFINDER_CUTS',
      markdownTable(
        ['Variable', 'Default', 'What it cuts'],
        collectOrthofinderCuts().map(
          c => `| ${codeCell(c.name)} | ${c.default} | ${tableCell(c.cuts)} |`,
        ),
      ),
      { check },
    ),
  ]
}
