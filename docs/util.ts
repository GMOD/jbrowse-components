import { exec } from 'child_process'
import { promisify } from 'util'

import * as ts from 'typescript'

const exec2 = promisify(exec)

export type TagType = (typeof TAG_TYPES)[number]

export interface ExtractedNode {
  type: TagType
  name: string
  comment: string
  signature: string
  node: string
  filename: string
  // Stable identity of the declaration this node's symbol resolves to
  // ("file:pos"). Lets the config generator match a `baseConfiguration` against
  // the `#config` it derives from by declaration identity rather than textual
  // name — robust to default-export aliasing (e.g. a const `BaseConnectionConfig`
  // imported as `baseConnectionConfig`).
  selfDeclId?: string
  // For `#baseConfiguration` nodes only: the declId of the base config the
  // right-hand-side expression references (alias-followed). undefined when the
  // base can't be resolved statically (e.g. `pluginManager.getDisplayType(...)`).
  baseDeclId?: string
  // For `#baseConfiguration` nodes only: a string literal found in the RHS, used
  // as a name fallback when declId resolution fails — e.g.
  // `pluginManager.getDisplayType('LinearWiggleDisplay')!.configSchema` links to
  // the config named "LinearWiggleDisplay".
  baseConfigName?: string
}

const TAG_TYPES = [
  'stateModel',
  'config',
  'slot',
  'preProcessSnapshot',
  'identifier',
  'baseConfiguration',
  'property',
  'volatile',
  'getter',
  'baseModel',
  'action',
  'method',
] as const

export function extractWithComment(
  fileNames: string[],
  cb: (obj: ExtractedNode) => void,
  options: ts.CompilerOptions = {},
) {
  const program = ts.createProgram(fileNames, options)
  const checker = program.getTypeChecker()

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      ts.forEachChild(sourceFile, visit)
    }
  }

  function visit(node: ts.Node) {
    const comment = getOwnJSDocText(node)
    const tags = comment ? TAG_TYPES.filter(t => hasTag(comment, t)) : []
    if (tags.length) {
      const { name, signature, declId } = describeSymbol(checker, node)
      const base = {
        name,
        comment,
        signature,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
        selfDeclId: declId,
        baseDeclId: tags.includes('baseConfiguration')
          ? resolveBaseConfigDeclId(checker, node)
          : undefined,
        baseConfigName:
          tags.includes('baseConfiguration') && ts.isPropertyAssignment(node)
            ? findStringLiteral(node.initializer)
            : undefined,
      }
      for (const type of tags) {
        cb({ type, ...base })
      }
    }
    ts.forEachChild(node, visit)
  }
}

function describeSymbol(checker: ts.TypeChecker, node: ts.Node) {
  const nameNode = getNameNode(node)
  const symbol = nameNode ? checker.getSymbolAtLocation(nameNode) : undefined
  const decl = symbol?.valueDeclaration
  return {
    name: symbol?.getName() ?? '',
    signature:
      symbol && decl
        ? checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, decl))
        : '',
    declId: symbolDeclId(checker, symbol),
  }
}

// "file:pos" of the declaration a symbol resolves to, following import aliases
// to the original declaration so two references to the same config (under
// different local/imported names) produce the same id.
function symbolDeclId(checker: ts.TypeChecker, symbol: ts.Symbol | undefined) {
  if (!symbol) {
    return undefined
  }
  let s = symbol
  while (s.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(s)
    if (aliased === s) {
      break
    }
    s = aliased
  }
  const decl = s.declarations?.[0] ?? s.valueDeclaration
  return decl
    ? `${decl.getSourceFile().fileName}:${decl.getStart()}`
    : undefined
}

// For a `baseConfiguration: <expr>` property, the declId of the base config the
// expr references. Peels call/non-null wrappers to the head identifier
// (`createBaseTrackConfig(pm)` -> `createBaseTrackConfig`); returns undefined for
// non-identifier heads like `pluginManager.getDisplayType(...)`.
function resolveBaseConfigDeclId(checker: ts.TypeChecker, node: ts.Node) {
  if (!ts.isPropertyAssignment(node)) {
    return undefined
  }
  let expr: ts.Expression = node.initializer
  while (ts.isNonNullExpression(expr) || ts.isCallExpression(expr)) {
    expr = expr.expression
  }
  return ts.isIdentifier(expr)
    ? symbolDeclId(checker, checker.getSymbolAtLocation(expr))
    : undefined
}

// First string literal anywhere in an expression (depth-first). Used to recover
// a config name from a dynamic `getDisplayType('Name')` base reference.
function findStringLiteral(node: ts.Node): string | undefined {
  let found: string | undefined
  const walk = (n: ts.Node) => {
    if (found === undefined) {
      if (ts.isStringLiteral(n)) {
        found = n.text
      } else {
        ts.forEachChild(n, walk)
      }
    }
  }
  walk(node)
  return found
}

function hasTag(comment: string, tag: TagType) {
  // require word boundary so #getter doesn't also match #getterById
  return new RegExp(`#${tag}(?![A-Za-z0-9_])`).test(comment)
}

function getNameNode(node: ts.Node): ts.Node | undefined {
  if (
    'name' in node &&
    node.name &&
    typeof node.name === 'object' &&
    'kind' in node.name
  ) {
    return node.name as ts.Node
  }
  return undefined
}

// JSDoc body text directly attached to this node (not inherited from
// ancestors). Uses the internal `jsDoc` parser property — unlike
// `getJSDocCommentsAndTags`, this does not walk up, so reference nodes like
// PropertyAccessExpression do not inherit JSDoc from their enclosing
// declaration.
//
// For VariableDeclaration, the JSDoc above `const Foo = ...` attaches to the
// parent VariableStatement, so we look there instead.
function getOwnJSDocText(node: ts.Node): string {
  const target: ts.Node = ts.isVariableDeclaration(node)
    ? node.parent.parent
    : node
  const jsDoc = (target as { jsDoc?: ts.JSDoc[] }).jsDoc
  if (!jsDoc) {
    return ''
  }
  return jsDoc
    .map(jd => {
      const c = jd.comment
      if (typeof c === 'string') {
        return c
      }
      return c ? c.map(p => p.text).join('') : ''
    })
    .join('\n')
}

// Extracts the entity name and human-readable description from a comment body
// like:
//   #stateModel LinearGenomeView
//   #category view
//   The actual description...
// Returns { name: "LinearGenomeView" || fallback, docs: "The actual description..." }
export function parseTaggedComment(
  comment: string,
  type: TagType,
  fallbackName: string,
) {
  const tag = `#${type}`
  const lines = comment.split('\n')
  let name = fallbackName
  const docs: string[] = []
  for (const line of lines) {
    if (line.includes(tag)) {
      const fromTag = line.replace(tag, '').trim()
      if (fromTag) {
        name = fromTag
      }
    } else if (!line.includes('#category')) {
      docs.push(line)
    }
  }
  return { name, docs: docs.join('\n') }
}

export function removeComments(string: string) {
  return string.replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim()
}

export interface ExtendsRef {
  name: string
  slug: string
}

// The composition graph is authored inside the #stateModel comment after an
// `extends` marker, in one of two styles:
//   extends
//   - [BaseDisplay](../basedisplay)
// or inline:
//   extends [BaseWebSession](../basewebsession)
// We parse those links back into structured refs so the generator can flatten
// the inherited API and validate that each link resolves. The extends block is
// the last thing in the doc body (member sections come from the template), so
// every relative model link after the marker is an extends ref.
export function parseExtends(docs: string): ExtendsRef[] {
  const marker = /^\s*extends\b/m.exec(docs)
  const refs: ExtendsRef[] = []
  if (marker) {
    const body = docs.slice(marker.index + marker[0].length)
    const re = /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g
    let match: RegExpExecArray | null
    while ((match = re.exec(body)) !== null) {
      refs.push({ name: match[1]!, slug: match[2]! })
    }
  }
  return refs
}

export async function getAllFiles() {
  const { stdout } = await exec2(
    String.raw`git ls-files | grep "\(plugins\|products\|packages\).*.\(t\|j\)sx\?$"`,
  )
  return stdout.split('\n').filter(Boolean)
}
