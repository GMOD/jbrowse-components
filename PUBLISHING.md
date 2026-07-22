# Releasing & Publishing

## Main Release

Two manual steps: write the draft, then publish the release.

1. **Write** `website/release_announcement_drafts/v<version>.md`. It becomes the
   summary of both the blog post and the GitHub release body; `pnpm release`
   aborts without it.
2. **Run** `pnpm release <patch|minor|major>`. It checks you're on a clean, up
   to date `main` with green CI, bumps every package version and `version.ts`,
   prepends the PR changelog to `CHANGELOG.md`, turns the draft into a dated
   `website/blog/*.md` post, updates `website/src/config.ts`, then commits,
   tags, and pushes.

   It doesn't re-run lint/tests locally; the push build already covers those and
   more. `--skip-ci-check` overrides the green-CI requirement.

3. **CI runs off the `v*` tag**, unattended: `publish.yml` → npm (`next` for
   prereleases, else `latest`), and `release.yml` → draft GitHub release with
   the notes already filled in, plus the web artifact and desktop binaries.
4. **Publish the draft** once the desktop binaries have landed in it. That click
   is the go/no-go gate: it fires both the announcements below and the website
   deploy, so the blog post goes live exactly when the release assets it links
   to become public.

`pnpm releasenotes [--tag v4.3.1]` prints the same body `release.yml` generates,
to eyeball locally.

## Prereleases

```bash
pnpm release --version 4.4.0-beta.1
```

`--version` sets the target explicitly instead of computing it, and any version
carrying a `-` is treated as a prerelease: no blog post, no `CHANGELOG.md`
entry, and `website/src/config.ts` is left alone, since that drives the download
page's asset links. CI follows the same split — npm gets the `next` dist-tag,
the GitHub release carries the prerelease flag, and the `latest/` deploy,
website deploy, and announcements all skip it. The draft release body will be
empty, with a warning in the run log saying so.

Useful for rehearsing a release, but not free: `publish.yml` really does publish
every package to npm under `next`, and npm only allows unpublishing for 72
hours. Pick a version number you're willing to leave there.

`--version` is also the way out if the previous version is itself a prerelease —
the patch/minor/major arithmetic requires a plain `X.Y.Z` base and will refuse.

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
`jbrowse-newsletter-send`; see `infrastructure/newsletter/`).

## Update Embedded Demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Verify at [jbrowse.org/demos/lgv](https://jbrowse.org/demos/lgv).
