# Agent documentation

Start with `PRD.md`. It is the governing doc for agent work on this branch.

## Current docs

| Doc                                                                  | Purpose                                                      | When to read                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **[PRD.md](PRD.md)**                                                 | Agent-governing PRD: priorities, invariants, paths          | Always (read first)                           |
| **[TODO.md](TODO.md)**                                               | Action items: quick hits, active plans, known issues        | Picking up work                               |
| **[OTHER_IDEAS.md](OTHER_IDEAS.md)**                                 | Future / exploratory concepts (not current work)            | Brainstorming, product direction              |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                               | Canonical GPU lifecycle / shaders / HAL reference           | Touching a display, backend, or shader        |
| **[CONFIG_PATTERN.md](CONFIG_PATTERN.md)**                           | Display config → MST snapshot → plain object → renderer     | Touching config, JEXL callbacks, RPC payloads |
| **[VIEW_INIT.md](VIEW_INIT.md)**                                     | Declarative `init` launch spec → afterAttach → state machine | Touching view launch, URL params, createViewState |
| **[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md)**                 | Browser + unit tests, WebGPU CI                             | Running or writing tests, validating RPC      |
| **[MIGRATION_AUDIT.md](MIGRATION_AUDIT.md)**                         | Config/session migration patterns + verification method     | Migrating a display or stored snapshot        |
| **[PERF_INSTRUMENTATION.md](PERF_INSTRUMENTATION.md)**               | Instrumentation patterns for GPU render / scroll jank       | Diagnosing a perf regression                  |
| **[RFC-001-community-plugin-api.md](RFC-001-community-plugin-api.md)** | Community plugin API proposal                              | Plugin API design                             |
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
