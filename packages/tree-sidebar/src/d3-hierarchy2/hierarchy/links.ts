// @ts-nocheck
export default function () {
  const root = this
  const links = []
  root.each(function (node) {
    if (node !== root) {
      // Don’t include the root’s parent, if any.
      links.push({ source: node.parent, target: node })
    }
  })
  return links
}
