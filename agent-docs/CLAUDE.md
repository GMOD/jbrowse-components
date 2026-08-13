# Agent documentation

The top level is exactly three files — `ARCHITECTURE.md` (canonical), `TODO.md`
(the backlog), and this file. Everything else is filed:

- `reference/` — everything settled: how a subsystem works, how to operate it,
  and the datasets behind the figures. A subsystem writeup belongs here, not at
  the top level.
- `ideas/` — not-committed concepts, one proposal per file. Its README index is
  **generated** by `website/scripts/generate-doc-indexes.ts` from each doc's
  `description:`, same as `reference/`.
- `architecture-decision-records/` — *why*, one decision per file. Its README
  index is **generated** by `website/scripts/generate-adr-index.ts`; don't hand-
  edit the block between the marker comments.
- `handoffs/` — the live state of a thread that is not finished: what landed,
  what is verified, what the next person has to decide. **Pointers, not content.**

**File first, then write the handoff against what you filed.** A handoff that
would still be useful with its links removed is holding something that belongs
in one of the homes below — which is what killed the first `handoffs/`: it
accumulated measured results, refuted hypotheses and whole subsystem profiles,
because parking is easier than filing. Delete the file when the thread lands.

- **A measurement, a profile, or how a subsystem behaves** → `reference/`.
- **Something tried and declined** → `reference/REJECTED_IDEAS.md`, with the
  number that declined it.
- **Work someone intends to do** → `TODO.md`, in the order to take it.
- **A proposal parked** → `ideas/`, as its own file.
- **What a session did, which commits, what is now green** → the commit messages
  and `git log`, which already hold it. A handoff may cite commits; it should not
  narrate them.

That last one applies to `CLAUDE.md` files too, and is the rule they break most
often. A file that explains what a subsystem replaced, dated, is holding
something git already has.

If you are about to write "state as of \<date\>" into a new **top-level** file,
that is the signal: split it into the homes above instead. In `handoffs/` that
sentence is the point of the file — but it is the only thing there that should
survive a read of the links.

The split between `TODO.md` and `ideas/` is commitment, not size: `TODO.md` is
work someone intends to do, an `ideas/` doc is a proposal thought through and
parked. A parked proposal often already contains the reasoning that kills the
obvious version of the idea, which is why re-proposing without reading it wastes
a session. Don't add a fifth folder — a `guides/` split alongside `reference/`
was tried and collapsed, because nothing landed cleanly on the line. If
`reference/` gets hard to scan, the fix is better `description:` lines.

## Generated tables

`pnpm autogen` sweeps this tree for `<!-- NAME START -->` / `<!-- NAME END -->`
pairs the same way it sweeps `website/docs`, and overwrites whatever is between
them. If a table here restates something a reader could check against the code,
write the generator instead of the table.

That rule is not a preference; it is what six drifted tables cost — a foundation
list naming a mixin its displays didn't compose, an autorun table clearing on a
prop that had become derived, a palette table missing a third of its keys, and a
re-export table five paths short *while the sentence above it called the source
file the source of truth*.

**The pattern worth copying: if a doc sentence tells the reader to go look at a
file, the table under it should be generated from that file.** Every one of those
was a list some author transcribed once and no one re-derived — the sentence goes
on being true as the table rots.

**Every doc outside `architecture-decision-records/` carries `name:` /
`description:` frontmatter, and that is load-bearing.** It is how you find the
right doc without opening all of them, so a new doc without one is invisible.
ADRs are the exception because the generated README index serves the same
purpose. `pnpm autogen --check` fails on a doc in `reference/` or `ideas/` that
carries none, so writing a good `description:` is the whole job of making a new
doc findable.

For those two directories, don't `ls` and guess — read
[reference/README.md](reference/README.md) or [ideas/README.md](ideas/README.md),
whose tables are generated from those same `description:` lines.

`TODO.md` is long enough to need its own index and opens with one. **Other docs
and a few source comments cite its sections by title**, so a heading there is a
reference someone may hold — rename one only after grepping for it. For `ideas/`
the same is true of *filenames*.

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

**Three CI jobs are gated by nothing in that list** — `pnpm check-format`,
`pnpm check-docs`, and the spell check (crate-ci/typos, run bare as `typos`).
None runs under `pnpm test` and none is a lint rule, so a change can be green by
every measure above and still land red; all three were red on `main` at once in
August 2026, on three *different* commits. The first two take seconds;
`check-docs` takes a couple of minutes and earns it only when you touched a doc
or moved a symbol a doc might name.

**Prefer the cheap decisive check over the browser probe** when the question is
"does release X have symbol Y". `git ls-remote --tags origin` for the newest tag,
then `git cat-file -e <tag>:<path>` — `ls-remote`, not local tags, or a checkout
that has not fetched in a while answers "no release yet" forever.

**Check what your worktree branched from before trusting a gate in it.** The
worktree tool's default base ref is **origin**'s default branch, which differs
from local `main` by however much has landed locally and not been pushed — which,
with agents landing all day, can be everything done that day. A gate can then
fail on a fix your branch predates, and the natural reading of that is "my edit
broke it".

    git merge-base --is-ancestor main HEAD && echo ok || git reset --hard main

**A validator that cannot import is not a validator that passed.** A worktree
that arrives with an incomplete install gives `check-docs` validators
ERR_MODULE_NOT_FOUND rather than any finding, and the run's summary counts that
as a failure with no detail. Read the body, not the tally.
