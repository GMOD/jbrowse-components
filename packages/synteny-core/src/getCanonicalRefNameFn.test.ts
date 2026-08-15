import { getCanonicalRefNameFn } from './getCanonicalRefNameFn.ts'

import type { AssemblyManager } from '@jbrowse/core/util'

// `getCanonicalRefName2` is the whole of the assembly surface this touches, and
// requireAssembly is the whole of the manager's.
function managerFor(aliases: Record<string, string>) {
  return {
    requireAssembly: (name: string) => {
      if (name !== 'volvox') {
        throw new Error(`assembly "${name}" could not be resolved`)
      }
      return Promise.resolve({
        getCanonicalRefName2: (refName: string) => aliases[refName] ?? refName,
      })
    },
  } as unknown as AssemblyManager
}

test('resolves every spelling the assembly knows, not one per contig', async () => {
  const canonical = await getCanonicalRefNameFn({
    assemblyManager: managerFor({ A: 'ctgA', contigA: 'ctgA' }),
    assemblyName: 'volvox',
  })
  expect(canonical('A')).toBe('ctgA')
  expect(canonical('contigA')).toBe('ctgA')
  expect(canonical('ctgA')).toBe('ctgA')
})

test('leaves a name the assembly does not know alone', async () => {
  const canonical = await getCanonicalRefNameFn({
    assemblyManager: managerFor({}),
    assemblyName: 'volvox',
  })
  expect(canonical('scaffold_7')).toBe('scaffold_7')
})

// A view with no assembly has nothing to rename INTO, which is different from
// naming one that cannot be resolved — that throws, so the name reaches the
// user rather than every refName quietly staying adapter-space.
test('is identity without an assembly name, and throws on an unresolvable one', async () => {
  const canonical = await getCanonicalRefNameFn({
    assemblyManager: managerFor({ A: 'ctgA' }),
    assemblyName: undefined,
  })
  expect(canonical('A')).toBe('A')
  await expect(
    getCanonicalRefNameFn({
      assemblyManager: managerFor({}),
      assemblyName: 'nonexistent',
    }),
  ).rejects.toThrow(/could not be resolved/)
})
