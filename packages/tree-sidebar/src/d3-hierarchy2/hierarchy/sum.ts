// @ts-nocheck
export default function (value) {
  return this.eachAfter(function (node) {
    let sum = +value(node.data) || 0
    const children = node.children
    let i = children?.length
    while (--i >= 0) {
      sum += children[i].value
    }
    node.value = sum
  })
}
