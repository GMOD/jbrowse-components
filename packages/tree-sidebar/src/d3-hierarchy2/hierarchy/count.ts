// @ts-nocheck
function count(node) {
  let sum = 0
  const children = node.children
  let i = children?.length
  if (!i) {
    sum = 1
  } else {
    while (--i >= 0) {
      sum += children[i].value
    }
  }
  node.value = sum
}

export default function () {
  return this.eachAfter(count)
}
