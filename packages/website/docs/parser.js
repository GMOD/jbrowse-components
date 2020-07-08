/* eslint-disable no-console,no-continue */
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin, // or fileStream
})

let readingHeader = false
let title = ''
let topLevel = false

;(async () => {
  for await (const line of rl) {
    if (!readingHeader && line == '---') {
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
        console.log(`\\newpage\\pagebreak\n \n\n\n# ${title}`)
      } else {
        console.log(`## ${title}`)
      }
      continue
    }
    if (readingHeader === false) {
      console.log(line)
    }
  }
})()
