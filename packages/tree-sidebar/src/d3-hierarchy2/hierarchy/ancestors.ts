// @ts-nocheck
export default function () {
  let node = this
  const nodes = [node]
  while ((node = node.parent)) {
    nodes.push(node)
  }
  return nodes
}
