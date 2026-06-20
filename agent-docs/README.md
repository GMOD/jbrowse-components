# Agent documentation

Start with `PRD.md`. It is the governing doc for agent work on this branch.

## Current docs

| Doc                                                                  | Purpose                                                      | When to read                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **[PRD.md](PRD.md)**                                                 | Agent-governing PRD: priorities, invariants, paths          | Always (read first)                           |
| **[TODO.md](TODO.md)**                                               | Action items to build/fix, plus a Pending-verification list | Picking up work                               |
| **[OTHER_IDEAS.md](OTHER_IDEAS.md)**                                 | Future / exploratory concepts (not current work)            | Brainstorming, product direction              |
| **[SYNTENY_BLOCK_IMPORT.md](SYNTENY_BLOCK_IMPORT.md)**               | Block-level synteny data: import from ntSynt/SyRI/MCScan vs own PAF chaining; LOD tiering | Whole-genome synteny hairball, block adapters, `make-pif --blocks` |
| **[CLUSTERING_WORKFLOW.md](CLUSTERING_WORKFLOW.md)**                 | In-app hierarchical clustering (wiggle + variants)          | Touching cluster dialogs, dendrograms, TreeSidebar |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                               | Canonical GPU lifecycle / shaders / HAL reference           | Touching a display, backend, or shader        |
| **[CONFIG_PATTERN.md](CONFIG_PATTERN.md)**                           | Display config → MST snapshot → plain object → renderer     | Touching config, JEXL callbacks, RPC payloads |
| **[VIEW_INIT.md](VIEW_INIT.md)**                                     | Declarative `init` launch spec → afterAttach → state machine | Touching view launch, URL params, createViewState |
| **[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md)**                 | Browser + unit tests, WebGPU CI                             | Running or writing tests, validating RPC      |
| **[MIGRATION_AUDIT.md](MIGRATION_AUDIT.md)**                         | Config/session migration patterns + verification method     | Migrating a display or stored snapshot        |
| **[PERF_INSTRUMENTATION.md](PERF_INSTRUMENTATION.md)**               | Instrumentation patterns for GPU render / scroll jank       | Diagnosing a perf regression                  |
| **[RFC-001-community-plugin-api.md](RFC-001-community-plugin-api.md)** | Community plugin API proposal                              | Plugin API design                             |
| **[PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md)**               | Why plugin exports ossify into permanent ABI + fixes (fleshes out RFC-001 §7) | Removing/renaming a plugin export; "why can't we delete this?" |
| **[architecture-decision-records/](architecture-decision-records/)** | Design decisions                                            | Understanding why something is the way it is  |

## Common questions

**"How do I add a new GPU display type?"** → `ARCHITECTURE.md` "Adding a new
GPU display type".

**"How do I debug failing browser tests?"** → `TEST_INFRASTRUCTURE.md`
"Debugging".

**"Why does the worker get what it gets?"** → `CONFIG_PATTERN.md` +
`ARCHITECTURE.md` §"The `rpcProps` / `gpuProps` pattern".

**"What invariants must I preserve?"** → `PRD.md` "Non-negotiable invariants".

**"What should I work on?"** → `TODO.md`.
