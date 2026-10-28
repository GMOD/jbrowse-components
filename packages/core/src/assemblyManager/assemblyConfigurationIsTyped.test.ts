import type { IsAny } from '../util/types/isAny.ts'
import type { Assembly } from './assembly.ts'

type Configuration = Assembly['configuration']

// Typecheck-only: assemblyFactory took the assembly config schema as IAnyType,
// so `assembly.configuration` read as `any`, and that it is a safeReference,
// absent once its config is removed, went unchecked.
test("an assembly's configuration is the assembly config, possibly absent", () => {
  const notAny: IsAny<Configuration> = false
  const mayBeAbsent: undefined extends Configuration ? true : false = true
  expect([notAny, mayBeAbsent]).toEqual([false, true])
})
