/* eslint-disable no-console,no-continue */
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin, // or fileStream
})

let readingHeader = false
let title = ''
let topLevel = false
let figure = ''
let caption = ''

;(async () => {
  for await (const line of rl) {
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
    if (line.startsWith('![')) {
      const res = line.match(/\(([^)]+)\)/)
      if (res) {
        // eslint-disable-next-line prefer-destructuring
        figure = res[1].replace('/jb2', '..')
        continue
      }
    }
    if (figure && line.trim() !== '') {
      caption += `${line} `
      continue
    }
    if (figure && caption) {
      console.log(`![${caption}](${figure})\n\n`)
      figure = ''
      caption = ''
      continue
    }
    if (readingHeader === false) {
      console.log(line)
    }
  }
})()
