# Releasing/Publishing

## Prerequisites

- Stable internet connection (AWS machine recommended to avoid npm publish failures)
- npm login: `pnpm login`
- For Mac builds: check https://developer.apple.com/account for updated signing terms

## Changesets Workflow

We use [changesets](https://github.com/changesets/changesets) to track changes and generate changelogs.

### Adding a Changeset (for contributors)

When making a PR with notable changes, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the semver bump type (patch/minor/major)
3. Write a summary of the change

The generated `.changeset/*.md` file should be committed with your PR.

### Release Process

#### 1. Create release announcement

Create `website/release_announcement_drafts/v<version>.md` with release notes.
Include screenshots/videos with absolute URLs. See https://jbrowse.org/jb2/blog for examples.

#### 2. Run release script

```bash
scripts/release.sh <patch|minor|major>
```

This will:
- Run lint and tests
- Bump versions in all packages
- Process any pending changesets (generates CHANGELOG.md entries)
- Generate blog post from draft
- Update website config
- Commit, tag, and push
- Publish all packages to npm

#### 3. Publish GitHub release

Wait for all build artifacts (jbrowse-web, mac/windows/linux desktop) to upload,
then publish the draft release on GitHub.

Copy release notes: `pnpm --silent releasenotes | pbcopy`

#### 4. Update embedded demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Check https://jbrowse.org/demos/lgv shows the new version.

## Alternative: Pure Changesets Workflow

You can also release using only changesets commands:

```bash
# Bump versions and generate changelog from changesets
pnpm version-packages

# Review changes, then publish
pnpm publish-packages
```
