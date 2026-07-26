// Compile-time proof that a display's real MST model still satisfies the
// structural type its lazy-loaded component takes. That type can't be
// `Instance<...>`: the contract lives in `@jbrowse/wiggle-core`, a package
// *below* this one, so it cannot import the model — unlike the canvas display,
// which registers its component in index.ts and types it off the model
// directly. Without the check, a renamed or dropped field is a silent runtime
// failure inside the lazy component, because the `DisplayMessageComponent`
// getter is typed `React.FC<any>` and erases it.
//
// Only the helper lives here. Each model still spells its own assertion out in
// its own file, so a "remove files with no importers" sweep can't drop the
// guard, and it's type-only either way — erased at runtime.
export type SatisfiesComponentContract<Contract, Model extends Contract> = Model
