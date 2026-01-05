# Releasing/Publishing

## Prerequisites

- Stable internet connection (AWS machine recommended to avoid npm publish
  failures)
- npm login: `pnpm login`
- GitHub CLI: `gh` (for changelog generation)
- For Mac builds: check https://developer.apple.com/account for updated signing
  terms

## Preview Changelog

To see what would be in the next release:

```bash
pnpm changelog
```

This uses `gh` CLI to list PRs merged since the last release.

## Release Process

### 1. Create release announcement

Create `website/release_announcement_drafts/v<version>.md` with release notes.
Include screenshots/videos with absolute URLs. See https://jbrowse.org/jb2/blog
for examples.

### 2. Run release script

```bash
scripts/release.sh <patch|minor|major>
```

This will:

- Run lint and tests
- Bump versions in all packages
- Generate changelog from merged PRs (via GitHub API)
- Generate blog post from draft
- Update website config
- Commit, tag, and push
- Publish all packages to npm

### 3. Publish GitHub release

Wait for all build artifacts (jbrowse-web, mac/windows/linux desktop) to upload,
then publish the draft release on GitHub.

Copy release notes: `pnpm --silent releasenotes | pbcopy`

### 4. Update embedded demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Check https://jbrowse.org/demos/lgv shows the new version.
