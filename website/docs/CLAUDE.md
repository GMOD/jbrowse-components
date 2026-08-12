# website/docs

Astro, not Docusaurus. Frontmatter is `title` (required), `description`,
`draft`, `sidebar_label`, `slug`; routing comes from the file path.

## Generated — never hand-edit

`pnpm autogen` rebuilds `config/`, `models/`, `api/`, the guide indexes
(`user_guide.md` etc.), `cli.md`, `jbrowse-img.md`, and every marker-pair block
(`<!-- COLOR_TABLE … -->`, `FILE_TYPES`, `DISPLAY_TYPES`, `DISPLAY_VIEW_TYPES`,
`GOTCHA`, `PROMOTABLE_SLOTS`, `DISPLAY_FOUNDATIONS`, `CROSS_CUTTING_MIXINS`,
`FETCH_AUTORUNS`, `PALETTE_KEYS`, `HELPER_PACKAGES`, `REEXPORT_MODULES`,
`MENU_ITEM_TYPES`, `MENU_ITEM_FIELDS`, `MENU_ITEM_BUILDERS`, `MENU_ACTIONS`,
`SPEC_KEYS`, `EXAMPLE_PLUGIN_TREE`, `SHADER_EXPORTS`, `ADAPTER_BASES`,
`SEARCH_RESULT_FIELDS`, `SLOT_TYPES`, `LAUNCH_VIEW_POINTS`, `ELEMENT_PHASES`).
Each renders from a JSDoc tag, a registration, or a manifest at the definition
site — document a new one by tagging the source. Everything else under `docs/`
is hand-written.

`ELEMENT_PHASES` is the one where the failure would be a table that stays
_complete_. It renders `PluginManager`'s `elementCreationSchedule` arguments,
and the pluggable-elements guide leans on that order hard — a track type can
look up a display type by name because displays are built first. Reorder the
schedule and a hand-written list still names all ten, still looks right, and the
dependency it documents is silently false.

`LAUNCH_VIEW_POINTS` is the second reader of the launch registry, and the one
that shows what a cross-page link costs. Its middle column deep-links each
`LaunchView-` point into that view type's section on `urlparams.md`, so the link
text and the anchor come from the `###` heading standing over that type's
`SPEC_KEYS` block rather than from anything typed twice — rename the heading and
the table follows it, where hand-written the link would 404 with nothing to
notice.

`SLOT_TYPES` is the one whose gate is not about the doc. Three tables define the
closed set of config slot types — the MST models in `configurationSlot.ts`, the
read types in `configuration/types.ts`, and the config editor's
type-string-to-control dispatch in `SlotEditor.tsx` — and only the first two are
checked against each other, by tsc. The dispatch has to be typed
`Record<string, …>`, so a slot type missing from it falls back to a plain text
box behind a `console.warn`: a number editing as free text, said nowhere a user
or a schema author looks. That is now a failed `pnpm autogen` instead.

`SPEC_KEYS` is the grouped one on `urlparams.md`:
`<!-- SPEC_KEYS <ViewType> -->` renders what a session spec may set on that
view, in the two buckets the launcher actually partitions on. **No path and no
view type is written down.** Which types need a block comes from the
`'LaunchView-<type>': { args: X }` entries the launchers add to PluginManager's
`ExtensionPointRegistry` — that IS the registry of what a spec can open. The
keys come from that args interface (minus what its `Omit<SnapshotIn<Model>, …>`
takes away, which the launcher builds itself), from a
`#launchKeys <ViewType>`-tagged Commands interface where the view keeps them
separately, from `#valueList <key>` for a key's accepted values, and from the
model's `#property` tags including everything it composes in.

So adding a spec-settable key means describing it at its declaration and nothing
else. Four things **fail** the run, and each is a mode this generator hit rather
than a hypothetical: a key with no description, a launchable view type no page
documents, a `ViewInit<>` Commands interface with no `#launchKeys` tag, and a
launch bucket where only some keys carry a comment. The last three all render a
table that looks complete and is short, which is the one failure a generated
table is supposed to make impossible.

The sweep also covers `agent-docs/`, which hosts the `DISPLAY_FOUNDATION_STACKS`
and `FETCH_AUTORUNS` counterparts. A guide table and its architecture-spec twin
come from one scan, so neither is a hand-mirror of the other.
`CROSS_CUTTING_MIXINS` goes further and renders the _same_ block in both, since
what a plugin author needs there ("which mixins can I compose, and what already
does") is what the spec needs too.

**A table a reader could check against the code is a generator waiting to be
written**, and the strongest tell is a sentence pointing at a file: the
re-export table sat directly under "treat that file as the source of truth" and
was five paths short. Every generated table above replaced a hand-written one
that had already gone wrong, and none of them failed loudly — each just quietly
stopped describing the code.

Where a generator needs prose it can't derive, the tag goes at the definition
site and a missing one is **fatal**, not a blank cell — same reasoning as the
untagged-`#slot` check. A blank cell reads as "this does nothing"; a failed
build reads as "write one line here".

**An `#example`'s keys are checked against the type's slots** (fatal, in
`generateConfigDocs`), because JBrowse ignores an undeclared key rather than
rejecting it — so a mistyped one loads, does nothing, and reads as the
documented way. `check-config-blocks` covers the hand-written blocks in the
guides and deliberately skips generated pages, which left the most-copied config
in the docs as the one surface with no checker at all. **Write the example in
the shape a reader pastes** — an alias or cytoband adapter inside the whole
assembly that carries it, a sequence adapter inside its
`ReferenceSequenceTrack`, a track as itself — and the check finds the object
whose `type` is the documented type, however deep that is. Internet accounts and
the root schemas aren't in the manifest, so they are skipped rather than guessed
at; **text search adapters are skipped too** because the manifest computes
`shorthandKeys` only for `group === 'adapter'`, so a Trix example's real `uri`
would read as an unknown key. Widen the check by fixing the manifest, not by
removing the skip.

## Avoiding drift in hand-written docs

- **Don't restate a config slot's default** — link
  `/docs/config/<type>/#slot-<name>`.
- **Don't hand-list a directory's pages** — use `<!-- doclist:<dir> -->`.
- **Prefer an `include:` marker over a copied code fence**, pointed at compiled
  tested source. `sync-doc-snippets --check` ratchets the count of un-included
  fences across **every hand-written page** — not just `developer_guides/`,
  which is where it started — so convert one and lower `DOC_FENCE_BASELINE`. The
  marker fills an existing fence rather than creating one, so write an empty
  ` ```ts ` block under it and run `pnpm sync-doc-snippets`.
- **Write `displayDefaults`, not a `displays` array**, unless the example
  selects a non-default display type or needs real `displayId`s.
- **Show a whole track config, not a fragment** — a reader has to be able to
  paste it. That means the `type`/`trackId`/`name`/`assemblyNames`/`adapter` and
  the slot in its `displayDefaults`, tagged ```json addtrack, **however small
  the point being made is**: a bare `{ "color": … }` or `{ "legend": […] }` blob
  is the tempting shape when a paragraph is about one slot, and it is the one
  shape a reader cannot use. Two slots that belong to the same recipe go in one
  config, not one fence each. `pnpm check-config-blocks` enforces it.
- **Write jexl the short way**: `feature.rank` over `get(feature,'rank')`.
- **`user_guides/` drives the UI, `config_guides/` shows the JSON.** When a
  config guide starts explaining a concept, that section belongs in the user
  guide.
- Cross-page anchors are `/docs/page#anchor` (no slash before `#`).

## Voice: dry and scientific, let the figure do the talking

The figure carries the result; the prose says what was done and what it means.
No drama or stakes, no rhetorical framing of a method, no reveals held for
effect, no conclusion one picture can't support. Applies to captions, gallery
descriptions, TL;DRs, and headings too.

**Don't argue with the previous version of the page.** Correcting a doc leaves a
strong pull toward writing the correction rather than the fact — "X is the
second thing tried, **not the first**", "these are part of the contract, **not
extras**", a paragraph justifying a behavior by describing the implementation it
replaced. The reader never saw the old text, so the contrast lands as an
argument with nobody, and the thing they came for (the order, the list, what to
do) is now the subordinate clause. State the behavior; put what it used to say
in the commit message, which is where the next author looks for it. The tell is
a sentence that only parses if you already know the old wording.

## The TL;DR

Every page under `user_guides/`, `config_guides/`, `developer_guides/` and
`tutorials/` opens with a `**TL;DR:**` paragraph. `pnpm check-tldr` enforces
that it exists and that it doesn't sell; what it can't check is whether the
paragraph is worth reading. Four failure modes, one page each from the sweep
that added the check:

- **Restating the title.** "load the Cancer Genome in a Bottle HG008 ... data
  into JBrowse" told a reader nothing the tab hadn't.
- **Restating itself.** "... a single assembly, and the project publishes the
  alignment, so comparing two haplotypes is one assembly, one alignment file and
  no pipeline" — the third clause is the first two, recounted as files.
- **Closing on a superlative** rather than a fact. This is the part `check-tldr`
  catches.
- **Crediting the page's result to the wrong mechanism.** The GC content TL;DR
  claimed the bacterial replication origin, which is a GC _skew_ result, and the
  page's own section said so.

Say what the page shows and the one thing that makes it work. A page whose body
is shorter than its summary would be needs no TL;DR, which is why the check has
a length floor.
