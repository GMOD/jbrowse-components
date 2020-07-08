const fs = require('fs')

const sidebar = JSON.parse(fs.readFileSync('../sidebars.json'))

function readTree(tree, ret = []) {
  Object.values(tree).forEach(value => {
    // don't push our course archive or faq to the pdf
    if (value.label === 'Archive') {
      return
    }
    if (typeof value === 'object') {
      readTree(value, ret)
      return
    }
    if (value) {
      ret.push(`${value}.md`)
    }
  })
  return ret
}

// eslint-disable-next-line no-console
console.log(readTree(sidebar).join('\n'))
