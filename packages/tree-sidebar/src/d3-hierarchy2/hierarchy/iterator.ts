// @ts-nocheck
export default function* () {
  let node = this
  let current
  let next = [node]
  let children
  let i
  let n
  do {
    ;((current = next.reverse()), (next = []))
    while ((node = current.pop())) {
      yield node
      if ((children = node.children)) {
        for (i = 0, n = children.length; i < n; ++i) {
          next.push(children[i])
        }
      }
    }
  } while (next.length)
}
