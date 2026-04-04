// @ts-nocheck
export default function (end) {
  let start = this
  const ancestor = leastCommonAncestor(start, end)
  const nodes = [start]
  while (start !== ancestor) {
    start = start.parent
    nodes.push(start)
  }
  const k = nodes.length
  while (end !== ancestor) {
    nodes.splice(k, 0, end)
    end = end.parent
  }
  return nodes
}

function leastCommonAncestor(a, b) {
  if (a === b) {
    return a
  }
  const aNodes = a.ancestors()
  const bNodes = b.ancestors()
  let c = null
  a = aNodes.pop()
  b = bNodes.pop()
  while (a === b) {
    c = a
    a = aNodes.pop()
    b = bNodes.pop()
  }
  return c
}
