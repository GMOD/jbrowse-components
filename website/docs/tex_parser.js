/* eslint-disable no-console */
const readline = require('readline')
const acorn = require('acorn')
const jsx = require('acorn-jsx')

const rl = readline.createInterface({
  input: process.stdin, // or fileStream
})
const parser = acorn.Parser.extend(jsx())
let readingHeader = false
let title = ''
let topLevel = false

;(async () => {
  for await (const line of rl) {
    if (line.startsWith('import Figure')) {
      continue
    }
    if (!readingHeader && line === '---') {
      readingHeader = true
      continue
    }
    if (readingHeader && line.startsWith('title')) {
      title = line.replace('title: ', '')
      continue
    }
    if (readingHeader && line.startsWith('toplevel')) {
      topLevel = true
    }
    if (readingHeader && line === '---') {
      readingHeader = false
      if (topLevel) {
        console.log(`\\newpage\\phantom{blabla}\\newpage\n \n\n\n# ${title}`)
      } else {
        console.log(`\n## ${title}`)
      }
      continue
    }
    if (line.startsWith('<Figure')) {
      const res = parser.parse(line, { ecmaVersion: 2020 })
      const src = res.body[0].expression.openingElement.attributes.find(
        attr => attr.name.name === 'src',
      )
      const caption = res.body[0].expression.openingElement.attributes.find(
        attr => attr.name.name === 'caption',
      )

      // chop off leading absolute figure /
      const srcval = src.value.value.slice(1)
      const captionval = caption.value.value
      console.log(`![${captionval}](${srcval})\n\n`)
      continue
    }

    if (readingHeader === false) {
      console.log(line)
    }
  }
})()
