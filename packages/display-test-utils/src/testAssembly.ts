import type { Region } from '@jbrowse/core/util'

export interface TestAssembly {
  initialized: boolean
  regions: Region[]
  getCanonicalRefName: (refName: string) => string
  getCanonicalRefName2: (refName: string) => string
  getGeneticCodeId: () => number | undefined
  configuration: { sequence: undefined }
}

const VOLVOX_CTGA: Region = {
  refName: 'ctgA',
  start: 0,
  end: 50_000,
  assemblyName: 'volvox',
}

/**
 * The stub assembly every display harness builds. **Every member the real
 * assembly exposes to a display is here whether or not the caller's tests reach
 * it**, which is the point: ten hand-written copies stubbed overlapping subsets
 * — `getCanonicalRefName2` in two of them, `getGeneticCodeId` in four — and a
 * display that grew a read of one landed on `undefined is not a function` in the
 * suites that had missed it.
 *
 * `aliases` maps a name onto its canonical form, matched case-insensitively as
 * the real resolver does. There is one by default on purpose: a stub that only
 * ever answers identity cannot tell a display that normalizes user-typed refName
 * text through `getCanonicalRefName` from one that skips it. Lower-casing
 * matters too — a stub that tolerated a non-string argument would be green over
 * a spec that takes the display down.
 */
export function testAssembly({
  regions = [VOLVOX_CTGA],
  aliases = { chra: 'ctgA' },
}: {
  regions?: Region[]
  /** keys are compared lower-cased */
  aliases?: Record<string, string>
} = {}): TestAssembly {
  const canonical = (refName: string) =>
    aliases[refName.toLowerCase()] ?? refName
  return {
    initialized: true,
    regions,
    getCanonicalRefName: canonical,
    getCanonicalRefName2: canonical,
    getGeneticCodeId: () => undefined,
    configuration: { sequence: undefined },
  }
}

/**
 * The manager wrapper, answering for one assembly by name. `waitForAssembly`
 * resolves the same object the synchronous `get` returns — two harnesses built
 * a second literal there and the two drifted apart on `getGeneticCodeId`.
 */
export function testAssemblyManager(
  assembly: TestAssembly,
  assemblyName = 'volvox',
) {
  const get = (name: string) => (name === assemblyName ? assembly : undefined)
  return {
    get,
    waitForAssembly: () => Promise.resolve(assembly),
    isValidRefName: () => true,
  }
}
