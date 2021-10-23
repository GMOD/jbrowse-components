const fs = require('fs')

const sidebar = JSON.parse(fs.readFileSync('../sidebars.json'))

function readTree(tree, res = []) {
  tree.forEach(subtree => {
    if (subtree.items) {
      if (
        !['JBrowse educational courses', 'Developer tutorials'].includes(
          subtree.label,
        )
      ) {
        readTree(subtree.items, res)
      }
    } else if (typeof subtree === 'string') {
      res.push(subtree)
    } else if (subtree.id !== 'combined' && subtree.id !== 'combined_pdf') {
      res.push(subtree.id)
    }
  })
  return res
}

const res = readTree(sidebar.sidebar)
  .map(elt => `${elt}.md`)
  .join('\n')

// eslint-disable-next-line no-console
console.log(res)
