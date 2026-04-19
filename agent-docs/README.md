# Agent Documentation

Start with `PRD.md`. It is the governing doc for agent work on this branch.

## Current docs

| Doc                                                                  | Purpose                                                 | When to read                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| **[PRD.md](PRD.md)**                                                 | Agent-governing PRD: priorities, invariants, paths      | Always (read first)                           |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                               | Canonical GPU lifecycle / shaders / HAL reference       | Touching a display, backend, or shader        |
| **[CONFIG_PATTERN.md](CONFIG_PATTERN.md)**                           | Display config → MST snapshot → plain object → renderer | Touching config, JEXL callbacks, RPC payloads |
| **[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md)**                 | Browser + unit test runners, WebGPU CI setup            | Running or writing tests                      |
| **[TODO.md](TODO.md)**                                               | Categorized backlog (architecture, display, UX, perf)   | Picking up a backlog item                     |
| **[OTHER_IDEAS.md](OTHER_IDEAS.md)**                                 | Future / exploratory concepts (not current work)        | Brainstorming, product direction              |
| **[DOTPLOT_REFACTOR.md](DOTPLOT_REFACTOR.md)**                       | Active plan: dotplot → shared MST lifecycle util        | Working on dotplot                            |
| **[SYNTENY_REFACTOR_PR_B.md](SYNTENY_REFACTOR_PR_B.md)**             | Active plan: synteny view owns one canvas (PR-B)        | Working on synteny                            |
| **[wiggle-core-plan.md](wiggle-core-plan.md)**                       | Active plan: extract `packages/wiggle-core`             | Touching wiggle scaling / alignments coverage |
| **[architecture-decision-records/](architecture-decision-records/)** | Design decisions (ADR-001 … ADR-005)                    | Understanding why something is the way it is  |
| **[completed/](completed/)**                                        | Historical migration state; COMPLETED.md is the archive | Retracing old work                            |

## Common questions

**"What should I work on?"** → `PRD.md` §3.

**"How do I add a new GPU display type?"** → `ARCHITECTURE.md` "Adding a new
GPU display type".

**"How do I debug failing browser tests?"** → `TEST_INFRASTRUCTURE.md`
"Debugging".

**"Why does the worker get what it gets?"** → `CONFIG_PATTERN.md` +
`ARCHITECTURE.md` §"The `rpcProps` / `gpuProps` pattern".

**"What invariants must I preserve?"** → `PRD.md` §4.
