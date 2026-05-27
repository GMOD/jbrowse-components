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
}

const TAG_TYPES = [
  'stateModel',
  'config',
  'slot',
  'preProcessSnapshot',
  'identifier',
  'baseConfiguration',
  'property',
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
      const { name, signature } = describeSymbol(checker, node)
      const base = {
        name,
        comment,
        signature,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
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
  }
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

export async function getAllFiles() {
  const { stdout } = await exec2(
    String.raw`git ls-files | grep "\(plugins\|products\|packages\).*.\(t\|j\)sx\?$"`,
  )
  return stdout.split('\n').filter(Boolean)
}
