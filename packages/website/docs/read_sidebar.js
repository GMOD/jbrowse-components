const fs = require('fs')

const sidebar = JSON.parse(fs.readFileSync('../sidebars.json'))

function readTree(tree, ret = []) {
  for (elt in tree) {
    if (tree[elt] === 'Archive') {
      return ret
    }
    if (typeof tree[elt] === 'object') {
      readTree(tree[elt], ret)
    }
    if (tree[elt]) {
      ret.push(tree[elt] + '.md')
    }
  }
  return ret
}
console.log(readTree(sidebar).join('\n'))
