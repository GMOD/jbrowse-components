# website/docs

Astro, not Docusaurus. Frontmatter is `title` (required), `description`,
`draft`, `sidebar_label`, `slug`; routing comes from the file path. Prose rules
are in `website/CLAUDE.md`.

## Generated — never hand-edit

`pnpm autogen` rebuilds `config/`, `models/`, `api/`, the guide indexes,
`cli.md`, `jbrowse-img.md`, and every `<!-- NAME START/END -->` marker block
from JSDoc tags, registrations and manifests at the definition site. Document a
new one by tagging the source. `scripts/autogen.ts` is the list of markers.

**A table a reader could check against the code is a generator waiting to be
written.** Every generated table replaced a hand-written one that had already
gone wrong, and none failed loudly. The strongest tell is a sentence pointing at
a file.

Where a generator needs prose it can't derive, the tag goes at the definition
site and a missing one is **fatal**, not a blank cell: a blank cell reads as
"this does nothing", a failed build reads as "write one line here". Four things
fail the `SPEC_KEYS` run for that reason.

**An `#example`'s keys are checked against the type's slots** (fatal), because
JBrowse ignores an undeclared key rather than rejecting it — a mistyped one
loads, does nothing, and reads as the documented way. **Write the example in the
shape a reader pastes**: an alias or cytoband adapter inside the whole assembly,
a sequence adapter inside its `ReferenceSequenceTrack`, a track as itself.
Internet accounts, root schemas and text-search adapters are skipped; widen the
check by fixing the manifest, not by removing a skip.

## Avoiding drift in hand-written docs

- **Don't restate a config slot's default** — link
  `/docs/config/<type>/#slot-<name>`. Same for a value a build script owns: it
  comes from a marker block, not from typing (`ORTHOFINDER_SETS` is the worked
  example).
- **Don't hand-list a directory's pages** — use `<!-- doclist:<dir> -->`.
- **Prefer an `include:` marker over a copied code fence**, pointed at compiled
  tested source. `sync-doc-snippets --check` ratchets un-included fences, so
  convert one and lower `DOC_FENCE_BASELINE`. The marker fills an existing
  fence, so write an empty one under it first.
- **Never retype a measurement table out of `agent-docs`** — bracket the copy
  with `<!-- BEGIN GENERATED MEASUREMENT <id> -->` / `END`
  (`sync-measurements.ts`). It comes from `agent-docs/measurements/<id>.json`
  through the doc that owns it, so a number here is three generators away from
  the run that produced it and typed nowhere. The whole table comes across; a
  page wanting fewer rows is a page arguing with the doc that owns the number.
  **Link the doc you published the table from** — `sync-measurements` requires
  it, because a table with no link back hands the reader a figure and no
  measurement.
- **Don't restate a number the page already carries** — quote the cell:
  `12.5ms<!--m:synteny-pick-random.1-10k.warmPickMs-->`, resolved by
  `sync-inline-figures` — marker after the value, no space in the pair, since a
  line starting `<!--` is an HTML block that ends its paragraph. `72%` beside a
  published `28%`, or `200x` off a `0.005` in the table above it, is arithmetic
  that goes stale the next time the table is regenerated, and
  `check-quoted-figures` cannot catch it because the old value is still in the
  doc it was copied from. Better still, say what the table cannot.
- Having a measurement block opts the page into `check-quoted-figures`, which
  requires every `<number><unit>` in its prose to appear in an agent-doc **the
  page links** or in the JSDoc of an **exported symbol the page names**. Both
  haystacks are what the page points a reader at, so cite the doc or name the
  symbol you took the figure from.
- **Write `displayDefaults`, not a `displays` array**, unless the example
  selects a non-default display type or needs real `displayId`s.
- **Show a whole track config, not a fragment**, tagged ```json addtrack —
  however small the point. A bare `{ "color": … }` blob is the one shape a
  reader cannot paste. `check-config-blocks` enforces it.
- **A `defaultSession` gets its own fence, tagged ```json session**, and must be
  its only top-level key, since `set-default-session` writes that key and
  nothing else.
- **Add `config=` to a session fence when a published config serves it** — it
  grows a live link. Opt-in, because a dead live link is worse than none. Two
  forms, usually the second:
  - `config=https://jbrowse.org/demos/<name>/config.json` — a manual
    `deploy-demo.sh` push.
  - `config=test_data/<name>/config.json` — synced from
    `products/jbrowse-web/test_data/` on every commit to main. **Keep it
    relative**, or every reader is pinned to one build instead of retargeting
    with `JBROWSE_CODE_BASE`.

  `check-session-urls` resolves either back to its source and fails on a missing
  track or assembly (JBrowse opens such a session silently), on an untracked
  config, and on a session that opens no tracks. **Ask what the session _shows_,
  not whether the check accepts it.**

- **Write jexl the short way**: `feature.rank` over `get(feature,'rank')`.
- **`user_guides/` drives the UI, `config_guides/` shows the JSON.** A config
  guide explaining a concept belongs in the user guide.
- Cross-page anchors are `/docs/page#anchor` (no slash before `#`).

## Voice and the TL;DR

Dry and scientific — the figure carries the result, the prose says what was done
and what it means. No drama, no conclusion one picture can't support.

Every page under `user_guides/`, `config_guides/`, `developer_guides/` and
`tutorials/` opens with a `**TL;DR:**` paragraph; `pnpm check-tldr` enforces
that it exists and doesn't sell. Say what the page shows and the one thing that
makes it work. The four ways it goes wrong: restating the title, restating
itself, closing on a superlative, and crediting the result to the wrong
mechanism.
