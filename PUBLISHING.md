# Releasing & Publishing

## Main Release

Steps 1-3 and 5 are yours; step 4 is CI running unattended off the tag.

1. **Write** `website/release_announcement_drafts/v<version>.md`. It becomes the
   summary of both the blog post and the GitHub release body; `pnpm release`
   aborts without it. Write the body only — `scripts/blog_template.txt` supplies
   the frontmatter, the `## Downloads` block, and the generated changelog, so a
   draft that carries its own will end up with two of each. Everything you write
   lands above `## Downloads`, which is the cut `splitReleaseBody` uses to
   separate your summary from the changelog. See
   [Figures in a draft](#figures-in-a-draft) if the post has screenshots.

   `pnpm check-release-drafts` validates it, and `pnpm check-docs` runs the same
   check in CI, so a draft is checked from the day it lands rather than on
   release day. It catches the mistakes that are unfixable once the tag is
   pushed: a figure that doesn't exist (deleted in a screenshot-review pass
   after the draft was written is the common one), a duplicated `## Downloads`
   that silently truncates the summary, its own frontmatter. `pnpm release` runs
   it again before it writes anything.

   **Have an agent read the finished draft against the source before you
   publish.** A draft is written months ahead of the release it describes, so
   between writing and shipping there is a whole development cycle in which a
   feature can be renamed, reverted or quietly dropped — and the draft is the
   one document here that describes the code and is never compiled against it.
   The v5.0.0 draft announced `jbrowse transitive-paf` for ten days after
   `79080af254` reverted the command, and named a `StatusChip` that had been
   renamed. Ask for every command, flag, config slot and component the draft
   names to be looked up in the tree, and for anything absent to be sorted into
   "gone, and the draft says so on purpose" or "stale claim". A checker was
   tried for this and is in `agent-docs/reference/REJECTED_IDEAS.md`.

   Check the published plugins too, on a major release:

   ```bash
   pnpm check-published-plugins
   ```

   It reports which plugin-store plugins read a `@jbrowse/core/*` name this
   build no longer serves — read off the shipped bundles, since nothing about
   that break is visible in a plugin's source. Needs the network, so it isn't a
   test and cannot ride `pnpm autogen`.

   `abi-watch.yml` runs it weekly as `--check`, against the committed baseline
   in `packages/core/src/ReExports/publishedPluginBreaks.json`, so the answer is
   already current when you get here and a plugin that started or stopped
   breaking has been reported since. If you quote the number in the draft, quote
   that file. Refresh it with `pnpm check-published-plugins --write` and say in
   the commit message which plugin moved.

   **If a package is publishing for the first time**, grep the docs for the
   sentence that says it isn't. Nothing else catches this: the manifests are
   already correct — every non-private package ships on the tag, since
   `publish.yml` runs a bare `pnpm publish -r` — so the only thing that goes
   stale is prose telling authors to work around the absence.

   ```bash
   git grep -n 'not on npm yet' -- website agent-docs
   ```

   The sixteen packages created after 4.3.0 were all first published manually on
   2026-08-31, at whatever version each manifest carried, because `publish.yml`
   authenticates only by trusted publishing and npm cannot configure a trusted
   publisher for a package that does not exist. A future new package needs the
   same manual first publish (plus its trusted-publisher config on npmjs.com)
   before the tag that first ships it.

   **Optionally**, write
   `website/release_announcement_drafts/v<version>.changelog.md` to replace the
   generated changelog for that one release. `pnpm release` uses it verbatim in
   place of `generate-changelog.sh` and consumes it the same way as the draft,
   so it is per-release rather than a permanent fork of the generator. It has to
   start with a `## Changes since …` heading — `splitReleaseBody` keys the
   section off that, and without it the changelog silently vanishes from the
   GitHub release body and the newsletter, which is why `check-release-drafts`
   checks it.

   Reach for this when the generated list would misrepresent the release. The
   generator lists merged PRs, so it is only as complete as the workflow that
   produced the release: v5.0.0 is 9051 commits behind 16 PRs, because most of
   the work landed on `main` directly. Nothing warns you about that ratio.

   The generated list covers everything merged since the previous release **tag
   was cut** — not since its draft was published, which is up to hours later and
   would leave the gap between the two in no changelog at all. Consecutive
   releases therefore abut exactly, and the boundary is still right if the
   previous draft was never published.

   A draft named after a prerelease (`v5.0.0-beta.1.md`) is rejected:
   prereleases get no blog post, so nothing would ever consume it. Name it after
   the stable release the beta series lands on.

   **A figure the draft states rather than shows goes in a marker, not in the
   prose.** Three kinds, in order of how much the draft has to do:

   - A measured table is a `<!-- BEGIN GENERATED MEASUREMENT <id> -->` block off
     `agent-docs/measurements/<id>.json`, and a single value quoted out of one
     is `1.4x<!--m:<id>.<row>.<column>-->`. `pnpm autogen` keeps both current
     and `prepareDraftNotes` strips the markers on the way to the blog. The
     v5.0.0 draft's zoom table was typed by hand beside a pan column no record
     holds.
   - Anything derived from `git` at the moment of release is a `${...}`
     placeholder that `release.ts` fills — `${DIFFSTAT}` is the one that exists.
     `pnpm autogen` cannot own these: they move under every commit, so a check
     would fail on every push. `check-release-drafts` rejects a name no release
     fills, since a misspelled one publishes literally and there is no number
     there to proofread.
   - A chart is a script, and one that reads git is a release-day step rather
     than an autogen entry: its last point moves with every commit, so a check
     would fail on every push. `pnpm loc-chart` re-renders the lines-of-code
     figure here. The three charts the v5.0.0 changelog carries come from a
     sibling checkout the way the renderer benchmarks do — collected in Python,
     plotted in ggplot2, sharing one `filters.py` and one theme:

     | Figure                                 | Run in `~/agent-docs-backup/theseus`                                                                                                  |
     | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
     | `code_age`                             | `collect_blame_cohorts.py`, then `Rscript R/plot_theseus.R` — about an hour to blame 115 snapshots. Copy `plots/04_code_age.png` over |
     | `code_composition`, `code_growth_zoom` | `collect_composition.py`, then `Rscript R/plot_composition.R`, which writes both straight into the figure tree                        |

     Then `pnpm figures:push --filter code_` here and commit `figures.lock`. The
     code-age collector's dev-line CSV ends at the snapshot it was built from,
     so extend it with `git log` before re-running or the chart stops where the
     last run did.

   **A figure in the changelog file needs an absolute URL.** `release.ts` drops
   that file in verbatim: only the notes get their image paths rewritten, by
   `prepareDraftNotes` for the blog and `absolutizeImages` for the GitHub
   release body. So `/img/...` renders on the site and 404s on GitHub, and
   `../static/img/...` misses both. Write `https://jbrowse.org/jb2/img/...` —
   `check-release-drafts` validates figure paths in the notes and does not look
   at the changelog.

2. **Look first** — `pnpm release <patch|minor|major> --dry-run`.

   It runs every check a real release runs, renders the blog post, the changelog
   and the version bump into a throwaway directory, formats them exactly as the
   real path would, prints the finished post and the list of files that would be
   committed, and stops. Nothing in the repo is touched and the draft stays put.

   The one difference between a dry run and a release is which directory the
   writers write into, so what it prints is the bytes that would be committed
   rather than a description of them. Worth doing every time: the post is the
   artifact with no second chance, and this is the only way to read it before it
   is public.

3. **Run** `pnpm release <patch|minor|major>`. It checks you're on a clean, up
   to date `main` with green CI, bumps every package version and `version.ts`,
   prepends the PR changelog to `CHANGELOG.md`, turns the draft into a dated
   `website/blog/*.md` post, updates `website/src/config.ts`, then commits,
   tags, and pushes.

   It doesn't re-run lint/tests locally; the push build already covers those and
   more. `--skip-ci-check` overrides the green-CI requirement.

   "Clean" means the files the release itself writes — `CHANGELOG.md`,
   `website/src/config.ts`, `website/blog`, the drafts directory, the manifests
   and the `version.ts` files. Those are exactly what `git commit -- <paths>`
   would pick up, so an uncommitted edit to one could ride into the release
   commit or be destroyed by it. Anything else in the worktree is left alone,
   which matters when several people or agents share one.

   The commit you're releasing has to be pushed and have a **finished** run.
   `push.yml` uses `cancel-in-progress`, so pushing again cancels the previous
   run's jobs, and a cancelled job is not a green one. On a busy day, push and
   then leave `main` alone until the run completes.

   Everything that can fail is checked before the first file is written — the
   tag is free locally and on origin, the draft exists and validates, `gh` can
   generate the changelog — because the write half runs straight into a commit,
   tag and push with no chance to intervene. If the **push** at the end fails
   anyway (someone landed on `main` during the install), the commit and tag are
   local: follow the recovery it prints, don't re-run, which would cut a second
   release commit on top of the first.

4. **CI runs off the `v*` tag**, unattended: `publish.yml` → npm (`next` for
   prereleases, else `latest`), and `release.yml` → draft GitHub release with
   the notes already filled in, plus the web artifact and desktop binaries.

   Both start by running `scripts/check-tag-version.ts`, which fails the run if
   the tag disagrees with **any** package version in the tree it points at.
   Neither workflow can recover from getting this wrong — npm only allows
   unpublishing for 72 hours, and the desktop jobs derive their upload target
   from `package.json`, so a mismatched tag clobbers another release's assets.
   Each desktop job then requires every artifact it is supposed to have built to
   be on disk before it uploads any of them, so a packaging step that quietly
   produced nothing fails its job instead of leaving a short release.

5. **Publish the draft** once the desktop binaries have landed in it. That click
   is the go/no-go gate: it fires both the announcements below and the website
   deploy, so the blog post goes live exactly when the release assets it links
   to become public.
6. **Re-point the ABI fixture** at what you just shipped, so
   `scripts/check-published-plugins.ts` reports plugin breakage against this
   release rather than a stale one:

   ```bash
   node --experimental-strip-types scripts/gen-abi-previous-release.ts <version>
   ```

   Do this after the npm publish in step 4 has landed, since it downloads the
   published tarball.

`pnpm releasenotes [--tag v4.3.1]` prints the same body `release.yml` generates,
to eyeball locally.

## Figures in a draft

Reference figures already in `website/static/img/` — either the site path
`/img/foo.png`, or the repo-relative `../static/img/foo.png` if you want them to
preview in the pull request that reviews the draft. Both work:
`prepareDraftNotes` converts the repo-relative form on the way into the post,
since `release.ts` commits, tags and pushes in one run and there is no later
chance to fix a path. It also drops HTML comments, so notes to whoever publishes
the release (placeholders, what still needs filling in) can live in the draft.

The same text reaches three places that resolve URLs differently, each handled
on the way out, so the draft only has to be right once:

| Consumer            | Rendered by         | Gets                                                         |
| ------------------- | ------------------- | ------------------------------------------------------------ |
| `website/blog/*.md` | the Astro site      | `/img/…`, with the base prefix added at build time           |
| GitHub release body | GitHub              | absolute `https://jbrowse.org/jb2/img/…` (`releasenotes.ts`) |
| Email newsletter    | `announceFormat.ts` | prose only — figures are stripped                            |

Figures are dropped from the newsletter rather than converted because `mdToHtml`
has no image case and the mail links out to the full post anyway, so keep the
summary paragraphs readable without them. `releaseBlog.test.ts` covers the first
two, `announceFormat.test.ts` the newsletter.

Once the post is on the site you can upgrade `![caption](src)` to
`<Figure caption="…" src="…" />`, which adds a lightbox and, for any image
backed by a screenshot spec, an "Open this view in JBrowse" link.

## Checking a draft against the code

**A sentence naming several things is where a draft goes wrong.** Two audits of
the v5.0.0 draft found fifteen false claims, and eight of them had that shape —
eight track types, five pinnable settings, three named modes — where most held
and one or two did not. Reading the head of such a list confirms nothing about
its tail, so expand every member and check each one. Both of that draft's
universals (`every track`, `everywhere`) failed the same way.

**Grep `agent-docs/` before tracing the code.** Both of those universals were
contradicted by a reference doc written before the draft was — one of them by
`ARCHITECTURE.md`, which carries the canonical list of exceptions to the very
sentence the draft had written as exceptionless.

**Generate anything that drifts under a commit**, rather than proofreading it.
`sync-measurements` and `sync-inline-figures` scan this directory, so a draft
takes numbers from `agent-docs/measurements/` the same two ways a docs page does
— a `BEGIN GENERATED MEASUREMENT` block for a table, a `<!--m:id.row.column-->`
marker for a figure quoted in prose. The diffstat is the placeholder
`${DIFFSTAT}`, which `release.ts` computes against the last stable tag reachable
from HEAD; `check-release-drafts` rejects any `${…}` no release fills, because a
misspelled one publishes literally and leaves no wrong number for a proofreader
to catch.

## Prereleases

`--version` sets the target explicitly instead of computing it. Any version
carrying a `-` is treated as a prerelease.

```bash
pnpm release --version 5.0.0-beta.1   # cut a beta
pnpm release --version 5.0.0-beta.2   # iterate
pnpm release --version 5.0.0          # promote to stable
```

Every step after the first needs `--version`: the patch/minor/major arithmetic
requires a plain `X.Y.Z` base and refuses to compute from a prerelease. The
final stable step is a normal release, so it needs its blog draft
(`website/release_announcement_drafts/v5.0.0.md`) like any other.

**What a prerelease does.** Bumps every package version and `version.ts`,
commits, tags, pushes. Then CI publishes to npm under the `next` dist-tag,
creates a draft GitHub release flagged as a prerelease with the web artifact and
desktop binaries, and uploads a preview build to
`https://jbrowse.org/code/jb2/v5.0.0-beta.1/` (a new tag-named prefix that
overwrites nothing). Consumers opt in explicitly:

```bash
npm install @jbrowse/react-linear-genome-view@next
```

**What it deliberately does not do.** No blog post — so a draft already sitting
in `website/release_announcement_drafts/` is neither required nor consumed, and
stays put for the stable release that takes it. No `CHANGELOG.md` entry, and
`website/src/config.ts` is left alone — it drives the download page's asset
links, so pointing it at a beta would advertise downloads the site shouldn't
offer yet. Those all belong to the stable release that follows. On the CI side
the `latest/` deploy, the `storybook/*` deploy, the jbrowse.org website deploy,
and the announcements are all gated off. Publishing the draft is safe: both
`announce.yml` and `update-docs.yml` check the prerelease flag.

The draft release body will be empty, with a `::warning::` in the run log saying
why — there is no blog post for `releasenotes.ts` to read.

**It is not free.** `publish.yml` really does publish every package to npm under
`next`, and npm only allows unpublishing for 72 hours. Pick a version number
you're willing to leave there.

## Announcing releases

Publishing a release fires the **Announce release** workflow, which posts to
Bluesky, Mastodon (`@usejbrowse@genomic.social`), and the email newsletter.
Prereleases are skipped. It runs on a GitHub runner with the repo secrets, so no
local credentials are needed, and it emails the summary (the part before
`## Downloads`) rather than the full changelog. Channels without credentials are
skipped. The blog post is also syndicated at <https://jbrowse.org/jb2/rss.xml>.

To preview or re-send by hand — Actions → **Announce release** → **Run
workflow**, or:

```bash
pnpm announce:dispatch                       # dry run (the default)
pnpm announce:dispatch -- -f dry_run=false   # real post + send
pnpm announce:dispatch -- -f dry_run=false -f tag=v4.3.1
pnpm announce -- --dry-run                   # local preview, no credentials
```

`--tag` selects which blog post to announce, defaulting to the newest.

Credentials live only in Actions secrets (`BLUESKY_IDENTIFIER`,
`BLUESKY_APP_PASSWORD`, `MASTODON_ACCESS_TOKEN`, plus AWS creds for
`jbrowse-newsletter-send`; see `products/aws/newsletter/`).

## Update Embedded Demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Verify at [jbrowse.org/demos/lgv](https://jbrowse.org/demos/lgv).
