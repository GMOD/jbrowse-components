# Agent Documentation

Start with `PRD.md`. It is the governing doc for agent work on this branch.

## Current docs

| Doc                                                                  | Purpose                                                 | When to read                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| **[PRD.md](PRD.md)**                                                 | Agent-governing PRD: priorities, invariants, paths      | Always (read first)                           |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                               | Canonical GPU lifecycle / shaders / HAL reference       | Touching a display, backend, or shader        |
| **[CONFIG_PATTERN.md](CONFIG_PATTERN.md)**                           | Display config → MST snapshot → plain object → renderer | Touching config, JEXL callbacks, RPC payloads |
| **[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md)**                 | Browser + unit tests, WebGPU CI, GetSubgraph validation | Running or writing tests, validating RPC     |
| **[TODO.md](TODO.md)**                                               | Categorized backlog (architecture, display, UX, perf)   | Picking up a backlog item                     |
| **[OTHER_IDEAS.md](OTHER_IDEAS.md)**                                 | Future / exploratory concepts (not current work)        | Brainstorming, product direction              |
| **[architecture-decision-records/](architecture-decision-records/)** | Design decisions                                        | Understanding why something is the way it is  |
| **[GRAPH_COARSE_MULTIASSEMBLY.md](GRAPH_COARSE_MULTIASSEMBLY.md)** | Multi-assembly symmetric coarse design (v2); supersedes v1 reference-biased design | Next coarse implementation work |
| **[completed/](completed/)**                                        | Historical migration state; COMPLETED.md is the archive | Retracing old work                            |
| **[tools/graph-truth-extractor/](../tools/graph-truth-extractor/)** | GetSubgraph RPC validation oracle (vg/odgi/naive)      | Debugging subgraph extraction discrepancies   |

## Common questions

**"What should I work on?"** → `TODO.md`.

**"How do I add a new GPU display type?"** → `ARCHITECTURE.md` "Adding a new
GPU display type".

**"How do I debug failing browser tests?"** → `TEST_INFRASTRUCTURE.md`
"Debugging".

**"Why does the worker get what it gets?"** → `CONFIG_PATTERN.md` +
`ARCHITECTURE.md` §"The `rpcProps` / `gpuProps` pattern".

**"What invariants must I preserve?"** → `PRD.md` "Non-negotiable invariants".
