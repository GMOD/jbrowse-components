/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from 'typescript'

interface Node {
  signature?: string
  code?: string
  type:
    | 'config'
    | 'slot'
    | 'baseConfiguration'
    | 'stateModel'
    | 'property'
    | 'baseModel'
    | 'method'
    | 'getter'
    | 'action'
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
    const count = node.getChildCount()

    // @ts-ignore
    const symbol = checker.getSymbolAtLocation(node.name)
    if (symbol) {
      serializeSymbol(symbol, node, cb)
    }

    if (count > 0) {
      ts.forEachChild(node, visit)
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

    if (comment?.includes('!config')) {
      cb({
        type: 'config',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!slot')) {
      cb({
        type: 'slot',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!baseConfiguration')) {
      cb({
        type: 'baseConfiguration',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!stateModel')) {
      cb({
        type: 'stateModel',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!property')) {
      cb({
        type: 'property',
        name: symbol.getName(),
        comment,
        signature: checker.typeToString(
          checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
        ),
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!getter')) {
      cb({
        type: 'getter',
        name: symbol.getName(),
        comment,
        signature: checker.typeToString(
          checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
        ),
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!method')) {
      cb({
        type: 'method',
        name: symbol.getName(),
        comment,
        signature: checker.typeToString(
          checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
        ),
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!baseModel')) {
      cb({
        type: 'baseModel',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    } else if (comment?.includes('!action')) {
      cb({
        type: 'action',
        name: symbol.getName(),
        comment,
        signature: checker.typeToString(
          checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
        ),
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
      })
    }
  }
}

export function removeComments(string: string) {
  //Takes a string of code, not an actual function.
  return string.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim() //Strip comments
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
