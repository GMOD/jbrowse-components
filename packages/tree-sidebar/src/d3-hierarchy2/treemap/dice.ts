// @ts-nocheck
export default function (parent, x0, y0, x1, y1) {
  const nodes = parent.children
  let node
  let i = -1
  const n = nodes.length
  const k = parent.value && (x1 - x0) / parent.value

  while (++i < n) {
    ;((node = nodes[i]), (node.y0 = y0), (node.y1 = y1))
    ;((node.x0 = x0), (node.x1 = x0 += node.value * k))
  }
}
