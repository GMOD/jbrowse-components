# Agent documentation

The top level is exactly three files — `ARCHITECTURE.md`, `TODO.md` and this one.
Everything else is filed:

- `reference/` — everything settled: how a subsystem works, how to operate it,
  and the datasets behind the figures.
- `ideas/` — not-committed concepts, one proposal per file.
- `architecture-decision-records/` — *why*, one decision per file.
- `handoffs/` — the live state of an unfinished thread. **Pointers, not
  content.** Delete the file when the thread lands.

The `reference/`, `ideas/` and ADR README indexes are **generated**; don't
hand-edit between the marker comments.

**File first, then write the handoff against what you filed.** A handoff still
useful with its links removed is holding something that belongs elsewhere — which
is what killed the first `handoffs/`.

- **A measurement, a profile, or how a subsystem behaves** → `reference/`.
- **Something tried and declined** → `reference/REJECTED_IDEAS.md`, with the
  number that declined it.
- **Work someone intends to do** → `TODO.md`, in the order to take it.
- **A proposal parked** → `ideas/`, as its own file.
- **What a session did, which commits, what is now green** → git already holds
  it. A handoff may cite commits; it should not narrate them.

That last one applies to `CLAUDE.md` files too and is the rule they break most.
"State as of \<date\>" in a new **top-level** file is the signal to split it into
the homes above; in `handoffs/` it is the point of the file.

`TODO.md` vs `ideas/` is commitment, not size. A parked proposal often already
contains the reasoning that kills the obvious version of the idea, so
re-proposing without reading it wastes a session. A `guides/` split alongside
`reference/` was tried and collapsed, nothing landing cleanly on the line; if
`reference/` gets hard to scan, the fix is better `description:` lines.

## Third parties: say what we chose, not how they rank

**A note can record a choice between two upstreams without characterizing either
one.** These files are public and mostly about projects that give their data
away, so a judgement on someone's reliability reads as this project's position —
and is almost never something the note measured. Justify a default by what it
does for us (one accession pins one assembly), not by a claim about the
alternative. A real limitation stays, as does an outage we hit, with the date.

## Generated tables

`pnpm autogen` sweeps this tree for `<!-- NAME START/END -->` pairs and
overwrites between them. **If a doc sentence tells the reader to go look at a
file, the table under it should be generated from that file** — six drifted
tables cost this rule, including a re-export table five paths short *while the
sentence above it called the source file the source of truth*.

**Every doc outside `architecture-decision-records/` carries `name:` /
`description:` frontmatter, and that is load-bearing** — it is how you find the
right doc without opening all of them, so `pnpm autogen --check` fails without
it. Don't `ls` and guess; read [reference/README.md](reference/README.md) or
[ideas/README.md](ideas/README.md).

**Other docs and source comments cite `TODO.md` sections by title**, so rename a
heading only after grepping for it. Same for `ideas/` *filenames*.

## Invariants — violations cause silent bugs, not crashes

- **MST owns the upload + render autoruns** (`attachRenderingBackend` on
  `RenderLifecycleMixin`), never a React `useEffect`.
- **The render callback returns `true` only when real content was drawn**, or the
  loading scrim stays up. Shared-canvas views (dotplot, synteny level) always
  return `true`.
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
verified change. **Then commit it.** Don't push or open a PR unless asked.

**Three CI jobs are gated by nothing in that list** — `pnpm check-format`, `pnpm
check-docs`, and the spell check (`typos`). None runs under `pnpm test` and none
is a lint rule, so a change can be green by every measure above and still land
red. The first two take seconds; `check-docs` earns its couple of minutes only
when you touched a doc or moved a symbol a doc might name.

**Prefer the cheap decisive check over the browser probe** for "does release X
have symbol Y": `git ls-remote --tags origin`, then `git cat-file -e <tag>:<path>`
— `ls-remote`, not local tags, or a stale checkout answers "no release yet"
forever.

**Check what your worktree branched from before trusting a gate in it.** The base
ref is **origin**'s default branch, which with agents landing all day can be a
whole day behind local `main` — so a gate fails on a fix your branch predates and
reads as "my edit broke it".

    git merge-base --is-ancestor main HEAD && echo ok || git reset --hard main

**`reset --hard` is only right before you have commits of your own**; from then
on `git rebase main` is the same check's answer and is also what makes the
landing fast-forward. Run it again before landing. The tell is a `git diff main`
naming files you never opened — that is main's commits missing from your branch,
which `git log main..HEAD -- <path>` distinguishes.

**A validator that cannot import is not a validator that passed.** An incomplete
install gives `check-docs` ERR_MODULE_NOT_FOUND rather than a finding, counted as
a failure with no detail. Read the body, not the tally.
