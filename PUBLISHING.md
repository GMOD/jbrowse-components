# Releasing & Publishing

## Main Release

Steps 1, 2 and 4 are yours; step 3 is CI running unattended off the tag.

1. **Write** `website/release_announcement_drafts/v<version>.md`. It becomes the
   summary of both the blog post and the GitHub release body; `pnpm release`
   aborts without it. Write the body only — `scripts/blog_template.txt` supplies
   the frontmatter, the `## Downloads` block, and the generated changelog, so a
   draft that carries its own will end up with two of each. Everything you write
   lands above `## Downloads`, which is the cut `splitReleaseBody` uses to
   separate your summary from the changelog. See
   [Figures in a draft](#figures-in-a-draft) if the post has screenshots.
2. **Run** `pnpm release <patch|minor|major>`. It checks you're on a clean, up
   to date `main` with green CI, bumps every package version and `version.ts`,
   prepends the PR changelog to `CHANGELOG.md`, turns the draft into a dated
   `website/blog/*.md` post, updates `website/src/config.ts`, then commits,
   tags, and pushes.

   It doesn't re-run lint/tests locally; the push build already covers those and
   more. `--skip-ci-check` overrides the green-CI requirement.

   The commit you're releasing has to be pushed and have a **finished** run.
   `push.yml` uses `cancel-in-progress`, so pushing again cancels the previous
   run's jobs, and a cancelled job is not a green one. On a busy day, push and
   then leave `main` alone until the run completes.

3. **CI runs off the `v*` tag**, unattended: `publish.yml` → npm (`next` for
   prereleases, else `latest`), and `release.yml` → draft GitHub release with
   the notes already filled in, plus the web artifact and desktop binaries.
4. **Publish the draft** once the desktop binaries have landed in it. That click
   is the go/no-go gate: it fires both the announcements below and the website
   deploy, so the blog post goes live exactly when the release assets it links
   to become public.

`pnpm releasenotes [--tag v4.3.1]` prints the same body `release.yml` generates,
to eyeball locally.

## Figures in a draft

A draft is copied into the blog post verbatim, and `release.ts` commits, tags
and pushes in the same run — so whatever paths are in the draft are what ship,
with no chance to fix them in between. Three places consume that same text, and
they resolve URLs differently:

| Consumer            | Rendered by                 | Needs                                                                       |
| ------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `website/blog/*.md` | the Astro site              | `/img/…` (the base prefix is added at build time)                           |
| GitHub release body | GitHub                      | an absolute URL — a `/img/…` path resolves against github.com, not the site |
| Email newsletter    | `mdToHtml` in `announce.ts` | nothing: it has no image case, so `![…](…)` arrives as literal text         |

So **write image paths as `/img/…`**, matching what the docs use. The figure
shows up on the blog, which is where the post actually lives and where the other
two link to.

Two consequences worth knowing before you write a figure-heavy post. Images will
not render in the GitHub release body, so lead with prose that stands on its own
there. And a draft with many figures makes for a poor newsletter, since each one
becomes a line of raw markdown — keep the summary paragraphs readable on their
own, or trim figures from the draft and let the blog post carry them.

If you drafted with repo-relative paths so the figures preview in a pull request
(`../static/img/…`, which resolves in the GitHub file view from either
`release_announcement_drafts/` or `blog/`), convert them before releasing:

```bash
sed -i 's|\.\./static/img/|/img/|g' website/release_announcement_drafts/v<version>.md
```

Once the post is on the site you can upgrade `![caption](src)` to
`<Figure caption="…" src="…" />`, which adds a lightbox and, for any image
backed by a screenshot spec, an "Open this view in JBrowse" link.

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
