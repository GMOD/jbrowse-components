---
name: a-shared-helper-for-the-rpc-method-classes-execute
description: A shared helper for the RPC method classes' `execute`
area: tooling-tests-and-docs
---

# A shared helper for the RPC method classes' `execute`

declined three
times. ~15 classes across 7 plugins repeat `deserializeArguments` → dynamic
`import()` → `execute({pluginManager, args})`, but the `import()` specifier
must stay a literal for bundlers and each executor's export name differs, so
the helper takes a thunk and lands at about the size of the ten lines it
replaces.
