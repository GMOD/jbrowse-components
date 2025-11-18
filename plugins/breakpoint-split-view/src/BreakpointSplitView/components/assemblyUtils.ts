import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

export function getCanonicalRefNames(
  assembly: Assembly,
  f1: Feature,
  f2: Feature,
) {
  const f1ref = assembly.getCanonicalRefName(f1.get('refName'))
  const f2ref = assembly.getCanonicalRefName(f2.get('refName'))

  if (!f1ref || !f2ref) {
    throw new Error(`unable to find ref for ${f1ref || f2ref}`)
  }

  return { f1ref, f2ref }
}
