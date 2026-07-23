import crypto from 'crypto'
// Local helper: flip screenshot-review.json entries.
// Usage:
//   node flip-review.mjs good <name> "<note>"    -> status good, hash=sha1 of PNG, note set
//   node flip-review.mjs remove <name>            -> delete the entry (spec+PNG gone)
import fs from 'fs'

const [, , cmd, name, note] = process.argv
const p = new URL('./screenshot-review.json', import.meta.url)
const j = JSON.parse(fs.readFileSync(p, 'utf8'))

if (cmd === 'remove') {
  delete j[name]
  console.log('removed', name)
} else if (cmd === 'good') {
  const png = new URL(`../static/img/${name}.png`, import.meta.url)
  const hash = crypto
    .createHash('sha1')
    .update(fs.readFileSync(png))
    .digest('hex')
  j[name] = {
    name,
    status: 'good',
    note: note ?? '',
    reviewedAt: new Date().toISOString(),
    hash,
  }
  console.log('good', name, hash)
} else {
  throw new Error(`unknown cmd ${cmd}`)
}

fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
