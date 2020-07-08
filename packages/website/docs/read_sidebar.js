const fs = require('fs')

const sidebar = JSON.parse(fs.readFileSync('../sidebars.json'))

function readTree(tree, ret = []) {
  Object.values(tree).forEach(value => {
    if (value === 'Archive') {
      return
    }
    if (typeof value === 'object') {
      readTree(value, ret)
    }
    if (value) {
      ret.push(`${value}.md`)
    }
  })
  return ret
}

// eslint-disable-next-line no-console
console.log(readTree(sidebar).join('\n'))
