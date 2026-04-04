// @ts-nocheck
export default function () {
  const leaves = []
  this.eachBefore(function (node) {
    if (!node.children) {
      leaves.push(node)
    }
  })
  return leaves
}
