# Agent documentation

The top level is exactly four files — `ARCHITECTURE.md` (canonical), `TODO.md`
(the backlog), `OTHER_IDEAS.md` (not-committed concepts), and this file.
Everything else is filed:

- `reference/` — everything settled: how a subsystem works, how to operate it,
  and the datasets behind the figures. A subsystem writeup belongs here, not at
  the top level.
- `architecture-decision-records/` — *why*, one decision per file. Its README
  index is **generated** by `website/scripts/generate-adr-index.ts`; don't hand-
  edit the block between the marker comments.
- `handoffs/` — where a session leaves the state of an unfinished thread: what
  was measured, what the next agent should not re-derive, and the decision left
  open. Read the matching handoff before picking a thread back up; **delete one
  once its thread closes** — if what it holds is durable, that means moving it
  into `reference/` or an ADR first, not summarizing it into a commit message.

`pnpm autogen` sweeps this tree for `<!-- NAME START -->` / `<!-- NAME END -->`
pairs the same way it sweeps `website/docs`, and overwrites whatever is between
them. If a table here restates something a reader could check against the code,
write the generator instead of the table.

**Every doc outside `architecture-decision-records/` carries `name:` /
`description:` frontmatter, and that is load-bearing.** It is how you find the
right doc without opening all of them, so a new doc without one is invisible.
ADRs are the exception because the generated README index serves the same
purpose.

For `reference/`, don't `ls` and guess — read
[reference/README.md](reference/README.md), whose table is generated from those
same `description:` lines and gives you all of them in one read. `pnpm autogen
--check` fails on a reference doc that carries no frontmatter, so the rule above
is now enforced rather than merely stated. Writing a good `description:` is
therefore the whole job of making a new doc findable.

`TODO.md` and `OTHER_IDEAS.md` are both long enough to need their own index, and
each opens with one. **Other docs and a few source comments cite their sections
by title**, so a section heading in either is a reference someone may hold —
rename one only after grepping for it.

The split between them is commitment, not size: `TODO.md` is work someone
intends to do, `OTHER_IDEAS.md` is a proposal thought through and parked. A
parked proposal often already contains the reasoning that kills the obvious
version of the idea, which is why re-proposing without reading it wastes a
session.

There was a `guides/` (how-tos) split alongside `reference/` (how it works) and
it was collapsed: nothing landed cleanly on the line, and since you `ls` both
anyway it cost a filing decision and bought nothing at read time. Don't
reintroduce it — if `reference/` gets hard to scan, the fix is better
`description:` lines, not more folders.

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
verified change. **Then commit it** — done means committed, not left in the
working tree. Don't push or open a PR unless asked.
