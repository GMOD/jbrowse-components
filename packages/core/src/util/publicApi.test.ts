import * as util from './index.ts'

// The `@jbrowse/core/util` barrel is the runtime ABI external plugins link
// against — a published UMD/ESM plugin resolves these names off the host app at
// load time, so removing one breaks plugins we don't build and can't typecheck.
// It fails at runtime inside the plugin, which is how dropping `defaultCodonTable`
// (a barrel tidy-up) shipped past a clean typecheck and full test run and turned
// jbrowse-plugin-protein3d's `generateCodonTable(defaultCodonTable)` into
// `Object.keys(undefined)`.
//
// The snapshot is not a rule against removing an export — it makes the removal
// visible in review. If a diff here is intended, update the snapshot in the same
// commit and say in the message which plugins were checked.
test('core/util barrel exports are stable', () => {
  expect(Object.keys(util).sort()).toMatchSnapshot()
})
