// @ts-nocheck
export default function (callback, that) {
  let node = this
  const nodes = [node]
  const next = []
  let children
  let i
  let n
  let index = -1
  while ((node = nodes.pop())) {
    next.push(node)
    if ((children = node.children)) {
      for (i = 0, n = children.length; i < n; ++i) {
        nodes.push(children[i])
      }
    }
  }
  while ((node = next.pop())) {
    callback.call(that, node, ++index, this)
  }
  return this
}
