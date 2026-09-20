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
- **Never retype a measurement table out of `agent-docs`**, and never restate a
  number the page already carries — bracket the table and quote the cell.
  `agent-docs/CLAUDE.md` has both syntaxes and the checker they answer to. The
  whole table comes across; a page wanting fewer rows is a page arguing with the
  doc that owns the number, and that doc has to be linked or the reader gets a
  figure and no measurement. `72%` beside a published `28%`, or `200x` off a
  `0.005` in the table above it, is arithmetic that goes stale the next time the
  table is regenerated. Better still, say what the table cannot.
- **Write `displayDefaults`, not a `displays` array**, unless the example
  selects a non-default display type or needs real `displayId`s.
- **Show a whole track config, not a fragment**, tagged ```json addtrack —
  however small the point. A bare `{ "color": … }` blob is the one shape a
  reader cannot paste. `check-config-blocks` enforces it.
- **A tagged fence renders its own routes, so don't narrate them.** The widget
  carries a Desktop tab beside the config and the CLI
  (`derive-desktop-steps.ts`) — pasted JSON for a track, the add-genome form for
  an assembly. So the prose says what the config IS and the tabs say how to
  apply it: "add this to the `tracks` array", "run the CLI command below" and
  "in Desktop use Open new genome" each duplicate a tab, and each reads to the
  other two thirds of the audience as the only way in. An assembly the form has
  no input for (`aliases`, `geneticCodes`, a non-sibling index) silently gets no
  such tab, which is the signal that the page owes that reader a sentence.
- **A whole config (one with `assemblies`) opens with
  `"$schema": "https://jbrowse.org/jb2/schema/v5/config.json"`**, the URL the
  generated schema names, so a reader who copies it gets completion and
  validation in their editor. `check-config-blocks` enforces it, and validates a
  fence whose `type` names a view against the schema's `View`.
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

## Voice

Dry and scientific — the figure carries the result, the prose says what was done
and what it means. No drama, no conclusion one picture can't support.

A page opens with a plain prose paragraph saying what it is about, with no
summary label over it. Say what the page shows and the one thing that makes it
work, in complete sentences and without "this page" or "this guide". The four
ways it goes wrong: restating the title, restating the paragraph under it,
closing on a superlative, and crediting the result to the wrong mechanism.

The anti-ai-writing-tropes checklist (github.com/cmdcolin/claudish) covers the
rest. `check-writing-tropes` ratchets the clefts and "silently" it can grep.
