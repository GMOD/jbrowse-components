# Agent documentation

`ARCHITECTURE.md` is canonical. `reference/` is how the system works, `guides/`
are operational how-tos, `architecture-decision-records/` is why — `ls` them and
read what the task needs. Backlog in `TODO.md`, and `handoffs/` is where a
session leaves the state of an unfinished thread: what was measured, what the
next agent should not re-derive, and the decision left open. Read the matching
handoff before picking a thread back up; delete one once its thread closes.

## Invariants — violations cause silent bugs, not crashes

- **MST owns the upload + render autoruns** (`attachRenderingBackend` on
  `RenderLifecycleMixin`), never a React `useEffect`.
- **The render callback returns `true` only when real content was drawn**, or the
  loading scrim stays up. Shared-canvas views (dotplot, synteny level) are the
  exception and always return `true`.
- **Per-region upload values must be freshly constructed, never mutated** —
  backends diff by reference identity.
- **Only write MST observables via actions.** A direct write inside an autorun
  body silently fails.
- **Shared backends key by `sharedBackendKey(self.id)`, never a list index** — an
  index renumbers when a sibling hides and aliases one display's buffer onto
  another.
- **Duck-typed interfaces across lazy boundaries.** Importing MST model types
  across a lazy import is a circular-reference trap.

## Definition of done

Typecheck the touched packages, `pnpm test <path>`, a browser test when UI
behavior changed, `pnpm lint --fix`. Regenerate snapshots only after a visually
verified change. Don't open a PR unless asked.
