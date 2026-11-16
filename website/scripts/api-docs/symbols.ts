import * as ts from 'typescript'

import { propertyType, typeSignature } from './typeSignatures.ts'

import type { NodeBase } from './docProgram.ts'
import type { PrintedType } from './typeSignatures.ts'

export function describeSymbol(
  checker: ts.TypeChecker,
  named: PrintedType[],
  node: ts.Node,
  isProperty: boolean,
  maxSignature?: number,
) {
  const nameNode = getNameNode(node)
  const symbol = nameNode ? checker.getSymbolAtLocation(nameNode) : undefined
  const decl = symbol?.valueDeclaration
  const symbolName = symbol?.getName() ?? ''
  const declaresType =
    ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
  const property =
    isProperty && ts.isPropertyAssignment(node)
      ? propertyType(checker, named, node.initializer)
      : undefined
  return {
    // `export default function Foo()` gives the symbol the name "default",
    // which is what the module exports it as and not what anyone calls it. The
    // declaration still carries `Foo`, so prefer that. Two such exports in one
    // package otherwise render as two `## default` sections on one page —
    // duplicate anchors, and nothing to tell them apart. (A default-exported
    // *const* already reads correctly; that aliasing is handled above.)
    name:
      symbolName === 'default' && nameNode && ts.isIdentifier(nameNode)
        ? nameNode.text
        : symbolName,
    signature: declaresType
      ? typeDeclaration(node)
      : (property?.type ??
        (symbol && decl && !isProperty
          ? typeSignature(checker, named, symbol, decl, maxSignature)
          : '')),
    declaresType,
    propertyDefault: property?.defaultValue,
    declId: symbolDeclId(checker, symbol),
  }
}

export type Described = ReturnType<typeof describeSymbol>

export function nodeBase(
  { name, signature, declId }: Described,
  comment: string,
  node: string,
  filename: string,
): NodeBase {
  return { name, comment, signature, node, filename, selfDeclId: declId }
}

const declarationPrinter = ts.createPrinter({ removeComments: true })

function typeDeclaration(
  node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
) {
  return declarationPrinter
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/^export /, '')
    .replaceAll(/^(?: {4})+/gm, indent => ' '.repeat(indent.length / 2))
}

// Follow import aliases to the original symbol so two references to the same
// declaration (under different local/imported names) resolve identically.
export function followAlias(checker: ts.TypeChecker, symbol: ts.Symbol) {
  let s = symbol
  while (s.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(s)
    if (aliased === s) {
      break
    }
    s = aliased
  }
  return s
}

// "file:pos" of the declaration a symbol resolves to, alias-followed.
export function symbolDeclId(
  checker: ts.TypeChecker,
  symbol: ts.Symbol | undefined,
) {
  if (!symbol) {
    return undefined
  }
  const s = followAlias(checker, symbol)
  const decl = s.declarations?.[0] ?? s.valueDeclaration
  return decl
    ? `${decl.getSourceFile().fileName}:${decl.getStart()}`
    : undefined
}

// A declaration's `name`, found among its children so it is typed as a node
function getNameNode(node: ts.Node) {
  const name = 'name' in node ? node.name : undefined
  return name
    ? ts.forEachChild(node, child => (child === name ? child : undefined))
    : undefined
}
