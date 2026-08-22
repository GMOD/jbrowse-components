import { doBeforeEach, getTestSession, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// `getCanonicalRefName2` is the repo's one total refName resolver, and the half
// that is easy to get wrong is not the unknown name — it is being asked before
// the alias file has landed. That window is not theoretical or racy: an
// assembly is in the manager from the moment the session reads its config and
// its aliases arrive an RPC later, so a getter or a render that runs on the
// first frame is IN it. Every hand-rolled `getCanonicalRefName(x) ?? x` this
// replaced read as total and threw here.
test('the total resolver answers before the aliases load, where the strict one throws', () => {
  const { session } = getTestSession()
  const assembly = session.assemblyManager.get('volvox')!

  expect(assembly.initialized).toBe(false)
  expect(() => {
    assembly.getCanonicalRefName('A')
  }).toThrow(/aliases not loaded/)
  expect(assembly.getCanonicalRefName2('A')).toBe('A')
})

// The other half, so the fallback above cannot be mistaken for the whole
// behaviour: once loaded it resolves, and `A` is an alias volvox declares.
test('and resolves the alias once they have', async () => {
  const { session } = getTestSession()
  const assembly = await session.assemblyManager.waitForAssembly('volvox')

  expect(assembly!.getCanonicalRefName2('A')).toBe('ctgA')
  // unknown names still come back untouched, which is what makes it total
  expect(assembly!.getCanonicalRefName2('scaffold_7')).toBe('scaffold_7')

  // seven callers hand it straight to something that takes a resolver
  // (`buildReadVsRefFeatures`, `resolveNamedRegions`) rather than wrapping it
  // in an arrow, which only works because the view body reads the closed-over
  // `self` and not `this`
  const { getCanonicalRefName2 } = assembly!
  expect(getCanonicalRefName2('A')).toBe('ctgA')
})

// the aliases the other direction: `getCanonicalRefName2` answers which
// sequence a name means, this answers what else that sequence is called —
// the question a user opens the assembly's About panel to ask, and the one
// nothing in the model could answer before
test('getAliasesForRefName answers from either side of the alias', async () => {
  const { session } = getTestSession()
  const assembly = await session.assemblyManager.waitForAssembly('volvox')

  expect(assembly!.getAliasesForRefName('ctgA')).toEqual(['A', 'contigA'])
  // asked by an alias, the canonical name is one of the answers
  expect(assembly!.getAliasesForRefName('A')).toEqual(['ctgA', 'contigA'])
  expect(assembly!.getAliasesForRefName('scaffold_7')).toEqual([])
})

// it resolves through the total resolver so a render can call it, which means
// the empty answer covers "not loaded yet" as well as "not this assembly's" —
// `initialized` is what separates them
test('getAliasesForRefName is empty, not a throw, before the aliases load', () => {
  const { session } = getTestSession()
  const assembly = session.assemblyManager.get('volvox')!

  expect(assembly.initialized).toBe(false)
  expect(assembly.getAliasesForRefName('ctgA')).toEqual([])
})
