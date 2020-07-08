/* eslint-disable no-console,no-continue */
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin, // or fileStream
})

let headerRead = false
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
      headerRead = true
      if (topLevel) {
        console.log(`# ${title}`)
      } else {
        console.log(`## ${title}`)
      }
      continue
    }
    if (headerRead) {
      console.log(line)
    }
  }
})()
