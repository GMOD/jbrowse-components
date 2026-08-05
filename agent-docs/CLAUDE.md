# Agent documentation

`ARCHITECTURE.md` is canonical. `reference/` is everything else that is settled —
how a subsystem works, how to operate it, and the datasets behind the figures;
`architecture-decision-records/` is why. `ls` them and read the `description:`
frontmatter, which is how you find the right one. Backlog in `TODO.md`, and
`handoffs/` is where a session leaves the state of an unfinished thread: what was
measured, what the next agent should not re-derive, and the decision left open.
Read the matching handoff before picking a thread back up; **delete one once its
thread closes** — if what it holds is durable, that means moving it into
`reference/` or an ADR first, not summarizing it into a commit message.

There was a `guides/` split (how-tos) alongside `reference/` (how it works) and
it was collapsed, because in practice nothing landed on the line: a doc opening
"design notes for unfinished work" was filed as a guide, a `CLUSTERING_WORKFLOW`
as reference, and `SCREENSHOT_CAPTURE_RACE`/`SCREENSHOT_PERF` ended up in
different folders. Since you `ls` both anyway, the split cost a filing decision
and bought nothing at read time. Don't reintroduce it; if `reference/` gets hard
to scan, the fix is better `description:` lines or an index, not more folders.

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
