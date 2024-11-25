import { exec } from 'child_process'
import { promisify } from 'util'
import * as ts from 'typescript'
const exec2 = promisify(exec)

interface Node {
  signature?: string
  code?: string
  type: string
  node: string
  name: string
  comment: string
  filename: string
}

export function extractWithComment(
  fileNames: string[],
  cb: (obj: Node) => void,
  options = {},
) {
  const program = ts.createProgram(fileNames, options)
  const checker = program.getTypeChecker()

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      ts.forEachChild(sourceFile, visit)
    }
  }

  function visit(node: ts.Node) {
    try {
      const count = node.getChildCount()

      // @ts-expect-error
      const symbol = checker.getSymbolAtLocation(node.name)
      if (symbol) {
        serializeSymbol(symbol, node, cb)
      }

      if (count > 0) {
        ts.forEachChild(node, visit)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function serializeSymbol(
    symbol: ts.Symbol,
    node: ts.Node,
    cb: (obj: Node) => void,
  ) {
    const comment = ts.displayPartsToString(
      symbol.getDocumentationComment(checker),
    )

    const fulltext = node.getFullText()
    const r = {
      name: symbol.getName(),
      comment,
      signature: checker.typeToString(
        checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
      ),
      node: fulltext,
      filename: node.getSourceFile().fileName,
    }

    const list = [
      'stateModel',
      'config',
      'slot',
      'identifier',
      'baseConfiguration',
      'property',
      'getter',
      'baseModel',
      'action',
      'method',
    ]
    for (const entry of list) {
      const type = `#${entry}`
      if (fulltext.includes(type) && r.comment.includes(type)) {
        cb({ type: entry, ...r })
      }
    }
  }
}

export function removeComments(string: string) {
  return string.replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim()
}

export function rm(str1: string, str2: string) {
  return str1
    .split('\n')
    .find(x => x.includes(str2))
    ?.replace(str2, '')
    .trim()
}

export function filter(str1: string, str2: string) {
  return str1
    .split('\n')
    .filter(x => !x.includes(str2))
    .join('\n')
}

export async function getAllFiles() {
  const files = await exec2(
    String.raw`git ls-files | grep "\(plugins\|products\|packages\).*.\(t\|j\)sx\?$"`,
  )
  return files.stdout.split('\n').filter(f => !!f)
}
