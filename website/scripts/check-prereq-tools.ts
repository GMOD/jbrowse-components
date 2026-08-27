// Every tool a tutorial's `## Prerequisites` names has to be a tool the page
// shows you running.
//
// A multipart tutorial gives each part its own `### Prerequisites`, so the
// reader installs what a part needs when they reach it rather than paying for
// the whole page up front. Every such list on a page is read, and one list
// naming a tool no fence anywhere on the page runs is still the failure — which
// part shows it is not something this check judges.
//
// The rule is in docs/tutorials/CLAUDE.md — "the command that produces the
// page's subject file goes in the prose, in a form a reader runs on their own
// equivalent data", and the line right under it, "watch for a tool in
// `## Prerequisites` that no fence on the page ever invokes". That was prose,
// and the corpus had drifted a long way from it: a page listed `plink` and
// showed no plink, listed vcftools and showed no vcftools, told a reader to
// install bedtools for lanes it then described in words. A reader who installs
// what a page asks for and finds no use for it on the page has been told to
// prepare for a tutorial that isn't there.
//
// So this asks the narrow, checkable version: does some fence on the page run
// it. Not which flags (that is check-script-commands, against the build script)
// and not where on the page. `bash`, `python` and `r` fences all count, since
// the analysis step of a page is in whichever language its tool speaks.
//
// Matching is on the fence TEXT, case-insensitively, rather than on the parsed
// command word. A tool is named in a prerequisite the way its docs name it and
// invoked the way the shell needs it — `DIAMOND` runs as `diamond`, `jcvi` as
// `python -m jcvi.compara.catalog`, `HiFiCNV` as `hificnv`, `flare.jar` as
// `java -jar flare.jar`, `liftOver` as `./liftOver` — and a check that insisted
// on the command word would report every one of those as missing.
//
// PLUMBING is the other half of staying quiet: a runtime, a fetcher, an
// installer or the bgzip/tabix prep that docs/tutorials/CLAUDE.md sends to
// quickstart_web is named because the reader needs it, not because the page is
// a tutorial about it.
//
// Run: `pnpm check-prereq-tools`, or the root `pnpm check-docs`.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { docsDir } from './paths.ts'

// Runtimes, fetchers, installers, and the file-prep tools whose own tutorial is
// quickstart_web. Lowercase; names are compared case-insensitively.
const PLUMBING = new Set([
  'apptainer',
  'apt',
  'awk',
  'bash',
  'bgzip',
  'bioconda',
  'brew',
  'conda',
  'curl',
  'dataformat',
  'datasets',
  'docker',
  'git',
  'gzip',
  'htsfile',
  'htslib',
  'java',
  'jq',
  'make',
  'node',
  'node.js',
  'npm',
  'npx',
  'path',
  'pip',
  'python',
  'python3',
  'r',
  'samtools',
  'sh',
  'singularity',
  'sort',
  'tabix',
  'tar',
  'unzip',
  'wget',
  'zcat',
])

// Named in a prerequisite, absent from every fence, and right to be: keyed
// `<page>#<tool>` so an entry stops applying if either moves. Each says why the
// page cannot show it, and "we didn't get round to it" is not one of the
// reasons — that case is a fence to write.
const ALLOWED = new Map([
  [
    'cancer_sv.md#minimap2',
    'sv_multihop.py runs it internally; the page shows the python invocation',
  ],
  [
    'homoeolog_synteny.md#biopython',
    'a python library jcvi imports, not a command',
  ],
  [
    'selection_pressure.md#biopython',
    'a python library jcvi imports, not a command',
  ],
  [
    'mcscan_synteny_grape_peach.md#LAST',
    'the aligner jcvi drives through --align_soft; nothing calls it directly',
  ],
  [
    'multiway_synteny_grape_peach_cacao.md#LAST',
    'the aligner jcvi drives through --align_soft; nothing calls it directly',
  ],
  [
    'pangenome_cactus.md#bedGraphToBigWig',
    'the whole-build script only, which the prerequisite itself says',
  ],
  [
    'scatac_pseudobulk.md#bedGraphToBigWig',
    'one of four upstream routes, each named with its own flags under "If your data lives somewhere else"',
  ],
  [
    'scatac_pseudobulk.md#ArchRProject',
    'an R object the reader already holds, not a command',
  ],
])

const tutorials = join(docsDir, 'tutorials')

// The `code` spans and link texts of a Prerequisites section, which is where a
// tool gets named either way.
// Fences come out first: a section's own ```bash block contributes no code
// span, and its delimiters would otherwise pair with the real spans around it
// and swallow them. That misreads a whole list once a page has more than one
// Prerequisites section to read.
function namesIn(sections: string[]) {
  const prose = sections
    .map(s => s.replaceAll(/```[\s\S]*?```/g, ''))
    .join('\n')
  return new Set([
    ...[...prose.matchAll(/`([^`]+)`/g)].map(m => m[1]!),
    ...[...prose.matchAll(/\[([^\]]+)\]\(http/g)].map(m => m[1]!),
  ])
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A name that is not a tool: a data file, a hostname, a format tag, an assembly
// the page's own configs name, or a config type its JSON blocks declare.
function isTool(
  name: string,
  assemblies: Set<string>,
  configTypes: string,
): boolean {
  return (
    /^[A-Za-z][\w.+-]*$/.test(name) &&
    !/\.(bam|cram|json|tsv|txt|fa|gz|bed|vcf|map|bw|bb|fai|sizes|out|md|org|com|io|net)$/i.test(
      name,
    ) &&
    !/^[A-Z]{1,3}$/.test(name) &&
    !PLUMBING.has(name.toLowerCase()) &&
    !assemblies.has(name) &&
    !new RegExp(`\\b${escape(name)}\\b`).test(configTypes)
  )
}

const problems: string[] = []
let checked = 0
let pages = 0
const unusedExemptions = new Set(ALLOWED.keys())

for (const file of readdirSync(tutorials).sort()) {
  if (!file.endsWith('.md') || file === 'CLAUDE.md') {
    continue
  }
  const src = readFileSync(join(tutorials, file), 'utf8')
  const sections = [
    ...src.matchAll(/\n(#{2,3}) Prerequisites\n([\s\S]*?)(?=\n#{1,3} |$)/g),
  ]
  if (!sections.length) {
    continue
  }
  pages++
  const fences = [...src.matchAll(/```(\w+)\n([\s\S]*?)```/g)]
  const runnable = fences
    .filter(f => /^(bash|python|r)$/i.test(f[1]!))
    .map(f => f[2]!)
    .join('\n')
    .toLowerCase()
  const configTypes = fences
    .filter(f => f[1] === 'json')
    .map(f => f[2]!)
    .join('\n')
  const assemblies = new Set(
    [...src.matchAll(/"assemblyNames": \[([^\]]*)\]/g)].flatMap(m =>
      m[1]!.split(',').map(n => n.trim().replaceAll('"', '')),
    ),
  )
  for (const name of namesIn(sections.map(m => m[2]!))) {
    if (!isTool(name, assemblies, configTypes)) {
      continue
    }
    checked++
    if (new RegExp(`\\b${escape(name.toLowerCase())}`).test(runnable)) {
      continue
    }
    const key = `${file}#${name}`
    if (ALLOWED.has(key)) {
      unusedExemptions.delete(key)
      continue
    }
    problems.push(
      `  tutorials/${file}`,
      `    → \`${name}\` is a prerequisite no fence on the page runs.`,
      `      Show the command it contributes, in the general form a reader would`,
      `      run on their own data, or add ${key} to ALLOWED in`,
      `      scripts/check-prereq-tools.ts with the reason.\n`,
    )
  }
}

// An exemption covering nothing has stopped being a record of anything: the
// page was renamed, or the fence it was standing in for finally got written.
for (const key of unusedExemptions) {
  problems.push(
    `  ALLOWED entry ${key}`,
    `    → matches no prerequisite now. Drop it.\n`,
  )
}

if (problems.length) {
  problems.unshift('Prerequisites that no fence on their page invokes:\n')
}
reportProblems(
  problems,
  `${checked} prerequisite tool(s) across ${pages} tutorial(s) are each invoked by a fence on their own page (${ALLOWED.size} recorded exceptions).`,
)
