/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from 'typescript'

interface Node {
  signature?: string
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
      })
    } else if (comment?.includes('!slot')) {
      cb({
        type: 'slot',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
      })
    } else if (comment?.includes('!baseConfiguration')) {
      cb({
        type: 'baseConfiguration',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
      })
    } else if (comment?.includes('!stateModel')) {
      cb({
        type: 'stateModel',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
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
      })
    } else if (comment?.includes('!baseModel')) {
      cb({
        type: 'baseModel',
        name: symbol.getName(),
        comment,
        node: node.getFullText(),
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
      })
    }
  }
}
