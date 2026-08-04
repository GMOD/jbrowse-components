import crypto from 'crypto'
// Local helper: flip screenshot-review.json entries.
// Usage:
//   node flip-review.mjs good <name> "<note>"     -> status good, hash=sha1 of PNG, note set
//   node flip-review.mjs answered <name> "<note>" -> status answered, same fields
//   node flip-review.mjs remove <name>            -> delete the entry (spec+PNG gone)
//
// `answered` is the one to reach for after addressing a denial: it says the note
// carries a reply and the call is the reviewer's, which `good` would be taking
// for them. It matters most when the fix moved no pixels ("no defect found",
// "nothing further to render") — there the hash still matches, so nothing else
// puts the entry back in the queue and it sits under Denied looking open.
import fs from 'fs'

const [, , cmd, name, note] = process.argv
const p = new URL('./screenshot-review.json', import.meta.url)
const j = JSON.parse(fs.readFileSync(p, 'utf8'))

if (cmd === 'remove') {
  delete j[name]
  console.log('removed', name)
} else if (cmd === 'good' || cmd === 'answered') {
  const png = new URL(`../static/img/${name}.png`, import.meta.url)
  const hash = crypto
    .createHash('sha1')
    .update(fs.readFileSync(png))
    .digest('hex')
  // An answered entry is hashed against the CURRENT image on purpose. It should
  // surface for one reason — that it has been answered — rather than also as
  // "changed since review", which would make the reviewer chase a diff that is
  // already described in the note.
  j[name] = {
    name,
    status: cmd,
    note: note ?? '',
    reviewedAt: new Date().toISOString(),
    hash,
  }
  console.log(cmd, name, hash)
} else {
  throw new Error(`unknown cmd ${cmd}`)
}

fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
