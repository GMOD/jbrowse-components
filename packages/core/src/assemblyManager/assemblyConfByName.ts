import { readConfObject } from '../configuration/index.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'

/**
 * The assembly config answering to `assemblyName` or one of its aliases. It
 * exists before the assembly's model does, which an autorun builds.
 */
export function assemblyConfByName(
  assemblyManager: { assemblyList: AnyConfigurationModel[] },
  assemblyName: string,
): AnyConfigurationModel | undefined {
  return assemblyManager.assemblyList.find(
    asm =>
      readConfObject(asm, 'name') === assemblyName ||
      ((readConfObject(asm, 'aliases') as string[] | undefined) ?? []).includes(
        assemblyName,
      ),
  )
}
