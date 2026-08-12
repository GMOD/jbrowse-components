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
- `handoffs/` — the live state of a thread that is not finished: what landed,
  what is verified, what the next person has to decide. **Pointers, not content.**

`handoffs/` is back as of 2026-08-11, and the reason it was removed is the rule
for using it. It existed until 2026-08-10 and held nine files, and what
accumulated there was measured results, refuted hypotheses and whole subsystem
profiles — because parking is easier than filing, and a doc nobody opens until
they pick that exact thread back up is a doc nobody reads. Two of the nine had
already been superseded by their own later sections.

So: **file first, then write the handoff against what you filed.** A handoff
that would still be useful with its links removed is holding something that
belongs in one of the homes below. Delete the file when the thread lands.

- **A measurement, a profile, or how a subsystem behaves** → `reference/`. Three
  of the old nine became reference docs outright (`CROSS_BACKEND_GATE.md`,
  `MAF_WORKER_PIPELINE.md`, `HPRC_RELEASE2.md`), which is a good sign they should
  have been there from the start.
- **Something tried and declined** → `reference/REJECTED_IDEAS.md`, with the
  number that declined it.
- **Work someone intends to do** → `TODO.md`, in the order to take it.
- **A proposal parked** → `OTHER_IDEAS.md`.
- **What a session did, which commits, what is now green** → the commit messages
  and `git log`, which already hold it. A handoff may cite commits; it should not
  narrate them.

If you are about to write "state as of \<date\>" into a new **top-level** file,
that is the signal: split it into the homes above instead. In `handoffs/` that
sentence is the point of the file — but it is the only thing there that should
survive a read of the links.

## Generated tables

`pnpm autogen` sweeps this tree for `<!-- NAME START -->` / `<!-- NAME END -->`
pairs the same way it sweeps `website/docs`, and overwrites whatever is between
them. If a table here restates something a reader could check against the code,
write the generator instead of the table.

That rule is not a preference; it is what six drifted tables cost.
ARCHITECTURE.md's foundation list claimed a `RegionTooLargeMixin` foundation used
by displays composing no such thing, its autorun table still cleared on a
`regionTooLarge` that had become derived, the palette table was missing a third
of its keys, the package table told plugin authors to bundle four packages that
depend on `@jbrowse/core`, and the re-export table was five paths short *while
the sentence above it called the source file the source of truth*. Each is now
generated, and a row joins one by existing in the source rather than by being
written down.

**The pattern worth copying: if a doc sentence tells the reader to go look at a
file, the table under it should be generated from that file.** Every one of those
was a list some author transcribed once and no one re-derived — which is the
failure the sentence-plus-stale-table shape produces every time, because the
sentence goes on being true as the table rots.

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

**Three CI jobs are gated by nothing in that list** — `pnpm check-format`,
`pnpm check-docs`, and the spell check (crate-ci/typos, run bare as `typos`).
None runs under `pnpm test` and none is a lint rule, so a change can be green by
every measure above and still land red. On 2026-08-12 all three were red on
`main` at once, and the format failures had arrived on three *different*
commits, which is what says it was a gate nobody ran rather than one slip. The
first two take seconds; `check-docs` takes a couple of minutes and earns it only
when you touched a doc or moved a symbol a doc might name.

**Prefer the cheap decisive check over the browser probe** when the question is
"does release X have symbol Y". `git ls-remote --tags origin` for the newest tag,
then `git cat-file -e <tag>:<path>` — `ls-remote`, not local tags, or a checkout
that has not fetched in a while answers "no release yet" forever.

**Check what your worktree branched from before trusting a gate in it.** The
root CLAUDE.md says the worktree tool creates it off local `main`; that tool's
own default base ref is **origin**'s default branch. Those differ by however
much local `main` is ahead — which, with agents landing locally and nothing
pushed, is everything done that day. Observed 2026-08-12: a fresh worktree came
up on an `origin/main` predating a `check-doc-imports` fix, so `pnpm check-docs`
failed on a reference the fix already accepts, and the natural reading of that
is "my edit broke it".

    git merge-base --is-ancestor main HEAD && echo ok || git reset --hard main

The same worktree also arrived with an incomplete install — `remark-parse`
absent at the root, so three of `check-docs`' validators died on
ERR_MODULE_NOT_FOUND rather than reporting anything. A validator that cannot
import is not a validator that passed, and the run's summary counts it as a
failure with no detail. Read the body, not the tally.
