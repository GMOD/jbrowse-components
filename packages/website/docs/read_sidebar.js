const fs = require('fs')

const sidebar = JSON.parse(fs.readFileSync('../sidebars.json'))

function readTree(tree) {
  let res = []
  res.push('introduction')
  res.push('quickstart_web')
  res.push('quickstart_desktop')
  tree.sidebar
    .filter(f =>
      [
        'Command line guide',
        'User guide',
        'Configuration guide',
        'Developer guide',
      ].includes(f.label),
    )
    .forEach(subtree => {
      if (subtree.items) {
        res = res.concat(subtree.items)
      } else res.push(subtree)
    })
  res.push('faq')
  return res
}

// eslint-disable-next-line no-console
console.log(
  readTree(sidebar)
    .map(elt => `${elt}.md`)
    .join('\n'),
)
