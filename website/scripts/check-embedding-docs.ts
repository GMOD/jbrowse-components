// Fails when the docs call jbrowse-anywidget or JBrowseR by a name the package
// no longer has, or write a launch view with a nested `init`, which JBrowse only
// unwraps with a warning now. Both packages cut helpers the docs kept teaching
// (`make_assembly`, `track()`, `synteny_view()`). The surfaces are read from the
// sibling checkouts, as check-menu-labels reads a plugin's, and a missing
// checkout is skipped.
//
// Run: `pnpm check-embedding-docs`, or the root `pnpm check-docs`.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { buildRecipe } from '../src/lib/spec-recipe/recipe.ts'
import { docFiles, reportProblems } from './check-utils.ts'
import { docRelative, docsDir, libraryCheckout, repoRoot } from './paths.ts'
import { screenshotLiveUrls } from './screenshot-specs.ts'

// What an R fence on these pages may call besides JBrowseR's own exports.
const OTHER_R_FUNCTIONS = new Set([
  'as.list',
  'c',
  'install.packages',
  'install_github',
  'library',
  'list',
  'paste0',
])

interface Fence {
  where: string
  lang: 'python' | 'r'
  code: string
}

// The text between the parenthesis at `open` and its match, skipping quoted
// strings so a `)` inside one does not close the call.
function parenthesized(src: string, open: number) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]!
    if (ch === '"' || ch === "'") {
      const close = src.indexOf(ch, i + 1)
      i = close === -1 ? src.length : close
    } else if (ch === '#') {
      const eol = src.indexOf('\n', i)
      i = eol === -1 ? src.length : eol
    } else if ('([{'.includes(ch)) {
      depth++
    } else if (')]}'.includes(ch)) {
      depth--
      if (depth === 0) {
        return src.slice(open + 1, i)
      }
    }
  }
  return src.slice(open + 1)
}

function topLevelParts(args: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!
    if (ch === '"' || ch === "'") {
      const close = args.indexOf(ch, i + 1)
      i = close === -1 ? args.length : close
    } else if ('([{'.includes(ch)) {
      depth++
    } else if (')]}'.includes(ch)) {
      depth--
    } else if (ch === ',' && depth === 0) {
      parts.push(args.slice(start, i))
      start = i + 1
    }
  }
  parts.push(args.slice(start))
  return parts
}

function keywords(args: string) {
  return topLevelParts(args).flatMap(part => {
    const match = /^\s*([\w.]+)\s*=(?!=)/.exec(part)
    return match ? [match[1]!] : []
  })
}

function unnamed(args: string) {
  return topLevelParts(args).some(
    part => part.trim() !== '' && !/^\s*(\*\*|[\w.]+\s*=(?!=))/.test(part),
  )
}

function calls(code: string, name: string) {
  return [
    ...code.matchAll(new RegExp(String.raw`(?<![\w.])${name}\s*\(`, 'g')),
  ].map(m => parenthesized(code, m.index + m[0].length - 1))
}

// Both packages pass a widget's options through to the product untouched, so
// the keys a call may use are the product's option interfaces.
function optionKeys(file: string, interfaces: string[]) {
  const src = readFileSync(join(repoRoot, 'products', file), 'utf8')
  return interfaces.flatMap(name => {
    const body =
      new RegExp(
        String.raw`^export interface ${name}\b[^{]*\{([\s\S]*?)^\}`,
        'm',
      ).exec(src)?.[1] ?? ''
    return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map(m => m[1]!)
  })
}

const LGV_OPTIONS = optionKeys(
  'jbrowse-react-linear-genome-view/src/createLinearGenomeView.ts',
  ['LinearGenomeViewState', 'CreateLinearGenomeViewOptions'],
)
const APP_OPTIONS = optionKeys('jbrowse-react-app/src/JBrowse/JBrowse.tsx', [
  'JBrowseProps',
])

interface PythonSurface {
  exports: Set<string>
  methods: Set<string>
  keywords: Map<string, Set<string>>
}

function pythonSurface(root: string): PythonSurface | undefined {
  const file = join(root, 'jbrowse_anywidget', '__init__.py')
  if (!existsSync(file)) {
    return undefined
  }
  const src = readFileSync(file, 'utf8')
  const all = /__all__\s*=\s*\[([^\]]*)\]/.exec(src)?.[1] ?? ''
  return {
    exports: new Set([...all.matchAll(/"(\w+)"/g)].map(m => m[1]!)),
    methods: new Set([...src.matchAll(/^ {4}def (\w+)\(/gm)].map(m => m[1]!)),
    keywords: new Map([
      ['LinearGenomeView', new Set(LGV_OPTIONS)],
      ['JBrowseApp', new Set(APP_OPTIONS)],
    ]),
  }
}

interface RSurface {
  exports: Set<string>
  formals: Map<string, Set<string>>
}

function rSurface(root: string): RSurface | undefined {
  const namespace = join(root, 'NAMESPACE')
  if (!existsSync(namespace)) {
    return undefined
  }
  const exports = new Set(
    [...readFileSync(namespace, 'utf8').matchAll(/^export\(([\w.]+)\)/gm)].map(
      m => m[1]!,
    ),
  )
  const formals = new Map<string, Set<string>>()
  for (const file of readdirSync(join(root, 'R'))) {
    const src = readFileSync(join(root, 'R', file), 'utf8')
    for (const m of src.matchAll(/^([\w.]+)\s*<-\s*function\s*\(/gm)) {
      formals.set(
        m[1]!,
        new Set(
          topLevelParts(parenthesized(src, m.index + m[0].length - 1)).flatMap(
            p => {
              const match = /^\s*([\w.]+)/.exec(p)
              return match ? [match[1]!] : []
            },
          ),
        ),
      )
    }
  }
  for (const [name, options] of [
    ['JBrowseR', LGV_OPTIONS],
    ['JBrowseRApp', APP_OPTIONS],
  ] as const) {
    formals.set(name, new Set([...(formals.get(name) ?? []), ...options]))
  }
  return { exports, formals }
}

function pythonProblems(fence: Fence, surface: PythonSurface) {
  const problems: string[] = []
  for (const m of fence.code.matchAll(
    /from jbrowse_anywidget import ([^\n]+)/g,
  )) {
    for (const name of m[1]!.split(',').map(n => n.trim())) {
      if (!surface.exports.has(name)) {
        problems.push(
          `imports ${name}, which jbrowse_anywidget does not export`,
        )
      }
    }
  }
  for (const [widget, accepted] of surface.keywords) {
    for (const args of calls(fence.code, widget)) {
      for (const keyword of keywords(args)) {
        if (!accepted.has(keyword)) {
          problems.push(
            `passes ${widget}(${keyword}=...), which is not a JBrowse option`,
          )
        }
      }
      if (unnamed(args)) {
        problems.push(
          `passes ${widget}() an unnamed value; every option is named`,
        )
      }
    }
  }
  for (const m of fence.code.matchAll(/\.(add_\w+)\(/g)) {
    if (!surface.methods.has(m[1]!)) {
      problems.push(`calls .${m[1]}(), which no widget defines`)
    }
  }
  return problems
}

function rProblems(fence: Fence, surface: RSurface) {
  const problems: string[] = []
  for (const m of fence.code.matchAll(/(?<![\w.$])([A-Za-z][\w.]*)\s*\(/g)) {
    const name = m[1]!
    if (!surface.exports.has(name) && !OTHER_R_FUNCTIONS.has(name)) {
      problems.push(
        `calls ${name}(), which JBrowseR does not export (a function from another package goes in OTHER_R_FUNCTIONS)`,
      )
    }
  }
  for (const [name, formals] of surface.formals) {
    if (!surface.exports.has(name)) {
      continue
    }
    for (const args of calls(fence.code, name)) {
      for (const keyword of keywords(args)) {
        if (!formals.has(keyword)) {
          problems.push(
            `passes ${name}(${keyword} = ...), which it does not take`,
          )
        }
      }
      if (formals.has('...') && unnamed(args)) {
        problems.push(
          `passes ${name}() an unnamed value; every option is named`,
        )
      }
    }
  }
  return problems
}

function initProblems(fence: Fence) {
  return /["']init["']\s*:|\binit\s*=/.test(fence.code)
    ? [
        'writes a view with a nested init; a view carries its settings beside its type, as defaultSession.views does',
      ]
    : []
}

function docFences(): Fence[] {
  return docFiles(docsDir).flatMap(file => {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(/^```(python|r)\n([\s\S]*?)^```/gm)].flatMap(m => {
      const lang = m[1] as Fence['lang']
      const code = m[2]!
      const line = text.slice(0, m.index).split('\n').length
      const relevant =
        lang === 'python'
          ? code.includes('jbrowse_anywidget')
          : /\bJBrowseR/.test(code)
      return relevant
        ? [{ where: `${docRelative(file)}:${line}`, lang, code }]
        : []
    })
  })
}

function snippetFences(): Fence[] {
  return Object.entries(screenshotLiveUrls).flatMap(([name, url]) => {
    const python = buildRecipe(url, name)?.python
    return python
      ? [
          {
            where: `"Notebook" tab of ${name}`,
            lang: 'python' as const,
            code: python,
          },
        ]
      : []
  })
}

const python = pythonSurface(libraryCheckout('jbrowse-anywidget'))
const r = rSurface(libraryCheckout('JBrowseR'))
const errorLines: string[] = []
const skipped: string[] = []
let checked = 0

for (const [label, surface] of [
  ['jbrowse-anywidget', python],
  ['JBrowseR', r],
] as const) {
  if (surface === undefined) {
    skipped.push(`${label} (no checkout at ${libraryCheckout(label)})`)
  } else if (surface.exports.size === 0) {
    errorLines.push(
      `  ${libraryCheckout(label)} exists but yields no exports; the reader here no longer matches how the package declares them.`,
    )
  }
}

if (LGV_OPTIONS.length === 0 || APP_OPTIONS.length === 0) {
  errorLines.push(
    '  the linear genome view or app option interface no longer parses; point optionKeys at where they moved',
  )
}

const seen = new Set<string>()
for (const fence of [...docFences(), ...snippetFences()]) {
  const surfaceProblems =
    fence.lang === 'python'
      ? python && pythonProblems(fence, python)
      : r && rProblems(fence, r)
  if (surfaceProblems === undefined) {
    continue
  }
  checked++
  for (const problem of [...surfaceProblems, ...initProblems(fence)]) {
    const key = fence.where.startsWith('"Notebook"')
      ? `snippet ${problem}`
      : `${fence.where} ${problem}`
    if (!seen.has(key)) {
      seen.add(key)
      errorLines.push(`  ${fence.where}: ${problem}`)
    }
  }
}

if (skipped.length > 0) {
  console.log(`Skipped ${skipped.join(', ')}`)
}
reportProblems(
  errorLines,
  `${checked} Python/R block(s) name only what jbrowse-anywidget and JBrowseR provide.`,
)
