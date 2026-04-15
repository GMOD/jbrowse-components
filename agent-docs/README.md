# Agent Documentation

Quick navigation for WebGL/WebGPU migration and GPU rendering architecture.

| Doc                                                                  | Purpose                                             | Audience                     |
| -------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------- |
| **[PRD.md](PRD.md)**                                                 | Project requirements, priorities, blockers          | Project leads, planning      |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                               | GPU rendering pipeline, adding new display types    | Display developers           |
| **[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md)**                 | Browser/unit tests, debugging, WebGPU CI setup      | Test engineers, developers   |
| **[CONFIG_PATTERN.md](CONFIG_PATTERN.md)**                           | Display config system, JEXL callbacks, RPC boundary | Config system users          |
| **[CONFIG_PATTERN_NEXT_STEPS.md](CONFIG_PATTERN_NEXT_STEPS.md)**     | Config tasks (snapshots, migrations, long-term)     | Config implementers          |
| **[TODO.md](TODO.md)**                                               | Categorized work items, technical debt              | Active developers            |
| **[OTHER_IDEAS.md](OTHER_IDEAS.md)**                                 | Future features, exploratory concepts               | Designers, research          |
| **[wiggle-core-plan.md](wiggle-core-plan.md)**                       | Extracting shared wiggle/coverage utilities         | Wiggle/alignments developers |
| **[architecture-decision-records/](architecture-decision-records/)** | Design decisions (ADR-001 through ADR-004)          | Architecture review          |

## Common Questions

**"How do I add a new GPU display type?"**  
→ See ARCHITECTURE.md "Adding a new GPU display type" (7-step walkthrough with
code examples)

**"How do I debug failing browser tests?"**  
→ See TEST_INFRASTRUCTURE.md "Debugging" (visual mismatches, timeouts, console
logs)

**"What's the config migration task?"**  
→ See PRD.md P1.4 + CONFIG_PATTERN_NEXT_STEPS.md (snapshot/property hoisting)

**"What needs to be done next?"**  
→ See PRD.md (priorities) or TODO.md (organized by category)

**"Why does GPU rendering work this way?"**  
→ See ARCHITECTURE.md (layers, lifecycle, multi-region pattern) or ADR files
(design decisions)
