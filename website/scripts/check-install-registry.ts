// Every package name in `api-docs/tutorialInstall.json` resolves on its
// registry: apt (the local `apt-cache`, skipped where there is none), bioconda
// or conda-forge, crates.io, PyPI, npm, and each download URL by a HEAD request.
//
// It needs the network, so `check-docs` leaves it out. Run it before editing the
// registry and now and then: `pnpm check-install-registry`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { reportProblems } from './check-utils.ts'

type Entry = Record<string, string | string[]>

const registry = JSON.parse(
  readFileSync(
    new URL('./api-docs/tutorialInstall.json', import.meta.url),
    'utf8',
  ),
) as Record<string, Entry>

async function exists(url: string, method = 'GET') {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    headers: { 'user-agent': 'jbrowse-components check-install-registry' },
  })
  return res.ok
}

function aptKnows(pkg: string) {
  try {
    return !execFileSync('apt-cache', ['policy', pkg], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).includes('Candidate: (none)')
  } catch {
    return undefined
  }
}

const probes: Record<string, (value: string) => Promise<boolean | undefined>> =
  {
    apt: async pkg => aptKnows(pkg),
    conda: async pkg =>
      (await exists(`https://api.anaconda.org/package/bioconda/${pkg}`)) ||
      (await exists(`https://api.anaconda.org/package/conda-forge/${pkg}`)),
    cargo: pkg => exists(`https://crates.io/api/v1/crates/${pkg}`),
    pip: pkg => exists(`https://pypi.org/pypi/${pkg}/json`),
    npm: pkg => exists(`https://registry.npmjs.org/${pkg}`),
    download: url => exists(url, 'HEAD'),
  }

const errors: string[] = []
let checked = 0
for (const [tool, entry] of Object.entries(registry)) {
  for (const [manager, value] of Object.entries(entry)) {
    for (const v of [value].flat()) {
      const probe = probes[manager]
      if (!probe) {
        errors.push(`${tool}: unknown manager "${manager}"`)
        continue
      }
      const ok = await probe(v)
      if (ok === undefined) {
        continue
      }
      checked++
      if (!ok) {
        errors.push(`${tool}: ${manager} "${v}" does not resolve`)
      }
    }
  }
}
reportProblems(errors, `${checked} registry entries resolve.`)
