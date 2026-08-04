// Local helper: flip screenshot-review.json entries.
// Usage:
//   node flip-review.ts good <name> "<note>"     -> status good, hash=sha1 of PNG, note set
//   node flip-review.ts answered <name> "<note>" -> status answered, same fields
//   node flip-review.ts remove <name>            -> delete the entry (spec+PNG gone)
//
// `answered` is the one to reach for after addressing a denial: it says the note
// carries a reply and the call is the reviewer's, which `good` would be taking
// for them. It matters most when the fix moved no pixels ("no defect found",
// "nothing further to render") — there the hash still matches, so nothing else
// puts the entry back in the queue and it sits under Denied looking open.
//
// Writes through updateReport, the same locked read-modify-write the review
// server uses. Editing the file directly instead — a jq pipeline, an editor —
// races a running server: both rewrite the whole map, so whichever lands second
// silently drops every verdict recorded since it read.
import { imageHash, updateReport } from './screenshot-review-lib.ts'

const [, , cmd, name, note] = process.argv

if (!name) {
  throw new Error(
    `usage: node flip-review.ts good|answered|remove <name> [note]`,
  )
}

if (cmd === 'remove') {
  const existed = updateReport(report => {
    const had = report[name] !== undefined
    delete report[name]
    return had
  })
  console.log(existed ? `removed ${name}` : `${name} had no entry`)
} else if (cmd === 'good' || cmd === 'answered') {
  const hash = imageHash(name)
  if (hash === undefined) {
    // Writing the verdict anyway would drop the `hash` key, and a verdict with
    // no hash is taken at face value forever — it could never resurface when
    // the image finally lands.
    throw new Error(`no PNG for ${name}; nothing to hash a verdict against`)
  }
  // An answered entry is hashed against the CURRENT image on purpose. It should
  // surface for one reason — that it has been answered — rather than also as
  // "changed since review", which would make the reviewer chase a diff that is
  // already described in the note.
  updateReport(report => {
    report[name] = {
      name,
      status: cmd,
      note: note ?? '',
      reviewedAt: new Date().toISOString(),
      hash,
    }
  })
  console.log(cmd, name, hash)
} else {
  throw new Error(`unknown cmd ${cmd}`)
}
