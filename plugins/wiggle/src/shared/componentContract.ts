// Compile-time proof that a display's real MST model still satisfies the
// structural type its lazy-loaded component takes. Needed because a
// `DisplayType`'s `ReactComponent` is typed `AnyReactComponentType`, so
// registering the pair erases the prop type — without this, a renamed or
// dropped field is a silent runtime failure inside the lazy component.
//
// The component's prop type can't simply BE the model's `Instance<...>`, which
// is how the feature display gets this check for free: the model's inferred
// type reaches the component's own file, so a structural slice avoids closing
// a type cycle. These types are also public API (`@jbrowse/plugin-wiggle`
// exports them), and manhattan's renderSvg takes one for the same reason.
//
// Only the helper lives here. Each model still spells its own assertion out in
// its own file, so a "remove files with no importers" sweep can't drop the
// guard, and it's type-only either way — erased at runtime.
export type SatisfiesComponentContract<Contract, Model extends Contract> = Model
