// Fails on a screenshot spec whose mistake would otherwise produce a
// plausible-looking figure rather than an error — a duplicate name, a compose
// part naming no spec, fields an embedded capture silently ignores. The rules
// live in screenshot-specs.ts next to the spec list; this is the CI entry point,
// and generate-screenshots runs the same function before it renders anything.
//
// Needs no browser and no build, so it runs in `pnpm check-docs` with the rest
// of the validators. Lives here rather than in a *.test.ts because jest doesn't
// cover website/ outside scripts/api-docs.
//
//   node website/scripts/check-specs.ts

import { specs, validateSpecs } from './screenshot-specs.ts'

const problems = validateSpecs()

if (problems.length > 0) {
  console.error(`${problems.length} screenshot spec problem(s):`)
  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }
  process.exit(1)
}

console.log(`${specs.length} screenshot specs are well formed.`)
