/* eslint-disable no-console */
const fs = require('fs')
const acorn = require('acorn')
const jsx = require('acorn-jsx')

const parser = acorn.Parser.extend(jsx())
let readingHeader = false
let title = ''
let topLevel = false

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n')
  const sub = process.argv[2].split('/').length
  for await (const line of lines) {
    if (line.startsWith('import Figure')) {
      continue
    }
    if (line.startsWith('import config')) {
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
    const depth = new Array(sub.length).fill('#').join('')
    if (readingHeader && line === '---') {
      readingHeader = false
      if (topLevel) {
        console.log(`\\newpage\\phantom{blabla}\\newpage\n \n\n\n# ${title}`)
      } else {
        console.log(`\n${depth}# ${title}`)
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
      if (line.startsWith('#')) {
        console.log(depth + line)
      } else {
        console.log(line)
      }
    }
  }
})()
