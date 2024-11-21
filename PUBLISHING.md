# Releasing/publishing

In order to publish a new version, follow the steps in this document

### Note: Use reliable internet and/or cloud machine!

Note that it is very helpful to run the release from a computer with a stable
and fast internet connection. One option for this is to run it from a AWS
machine. The reason for this is that if you have a flaky internet at all, it may
result in one of the npm publish jobs from any one of the packages in the
monorepo failing to upload to NPM with a network problem, and then this
basically means you have to run another release because it is difficult to
continue the release process after that failure. See
https://github.com/GMOD/jbrowse-components/issues/2697#issuecomment-1045209088

### Step 0. (optional) Check developer.apple.com for updated mac app signing terms

The Mac app signing system frequently wants you to agree to their updated
license terms. Log in to https://developer.apple.com/account if you have access
or ask team member to do so.

The Mac specific electron build github action may otherwise fail with an error
such as:

```
Error: HTTP status code: 403. A required agreement is missing or has expired.
This request requires an in-effect agreement that has not been signed or has
expired. Ensure your team has signed the necessary legal agreements and that
they are not expired.
```

Note: you can possibly recover from this if the electron builds fail and the NPM
versions haven't published yet. You can cancel the scripts/release.sh script and
then revert the commits it made, and then re-run the release/scripts.sh. If the
NPM scripts did already publish though, you will have to publish yet another new
version, complete with new release draft, etc.

### Step 1. Create announcement file in `website/release_announcement_drafts/<tag>.md`

We first edit a file e.g. `website/release_announcement_drafts/v2.6.2.md` and
make a pull request to propose the release.

The markdown of this draft file will be automatically converted to a blogpost on
the website by the scripts/release.sh script and can contain an overview of the
major features and bugfixes in the release, with as many nice screenshots or
movies as possible. You can upload screenshots or videos in the github comment
thread, and use markdown ![](github url here) to link them. At the very least,
the images should be absolute URLs instead of relative because the same text is
pasted in blogpost and GitHub release pages.

The release script will automatically add download links and detailed changelog
information to this post.

You can see examples of the finished posts at https://jbrowse.org/jb2/blog.

If you want to preview the changelog to help write the release announcement, you
can use the command
`GITHUB_AUTH=<auth_token> yarn --silent lerna-changelog > tmp_changelog.md`
(make sure to run the command on the main branch).

See the next step if you need to generate an access token.

### Step 2. Create a GitHub access token with public_repo scope

To generate one, go to https://github.com/settings/tokens, click "Generate new
token," add a note describing what you want the token to be for, select the
"public_repo" checkbox (under "repo"), and then click "Generate token." Make
sure to save this token in a safe place to use for future releases as you won't
be able to see it again. If you do lose your token, delete/revoke the token you
lost and generate a new one.

### Step 3. Run scripts/release.sh

Decide if the release should have a major, minor, or patch level version, and
then run

```bash
scripts/release.sh myGitHubAuthToken versionIncreaseLevel
```

If you don't provide `versionIncreaseLevel`, it will default to "patch".

This will trigger a GitHub workflow that will create a draft release on GitHub,
build JBrowse Web, and upload the build to that release. It will also trigger
workflows that will build JBrowse Desktop for Windows, Mac, and Linux and upload
those to the release as well.

### Step 4. Publish the draft on GitHub ALL build artifacts are completed

First confirm that the build artifacts from all four workflows (jbrowse-web,
mac, windows, and linux desktop builds) have been added to the release, click
"Publish release" (if you publish before the artifacts are uploaded, the
workflows will refuse to add them to the published release since it looks for
draft releases)

Then run `yarn --silent releasenotes|pbcopy` to get the release notes in a
copy-and-pasteable way for the github release (it is slightly different than the
blogpost format)

### Step 5. Update embedded demos

Finally, update the embedded demos using some bash scripts. This is not fully
automated, but you can run each step and check that there aren't any errors

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Then you can manually check e.g. https://jbrowse.org/demos/lgv and see that the
"About" dialog says the updated version

Note that the deploy step requires that you have the AWS CLI tools, and have
authenticated with the jbrowse.org account

### Step 6. Publish JBrowseR update to CRAN

Make sure you have role c("aut","cre") in the JBrowseR DESCRIPTION file or else
add yourself and make it so. Then run steps similar to the following

```bash
git clone git@github.com:GMOD/JBrowseR
cd JBrowseR

>> manually update DESCRIPTION with new version number to be used, and NEWS.md with changelog

# get latest @jbrowse/react-linear-genome-view, repo has a normal package.json
# and yarn.lock
yarn upgrade

# runs webpack
yarn build


# commit built artifacts
git add .
git commit -m "Update deps"

# start R session
R
> install.packages(devtools)
> devtools::submit_cran()
```

### Step 7. Publish dash_jbrowse update to PyPI

```bash

# clone repo and use virtualenv for installing deps, needed for building (e.g.
# dash-generate-components)
pip install virtualenv

git clone git@github.com:GMOD/dash_jbrowse
cd dash_jbrowse
python3 -m venv ./venv
source venv/bin/activate
pip install -r requirements.txt

## check that it works as-is in local browser
python usage.py



# get latest @jbrowse/react-linear-genome-view, repo has a normal package.json
# and yarn.lock
yarn upgrade

# runs webpack
yarn build

# commit built artifacts
git add .
git commit -m "Update deps"

# create new tag e.g.
git tag v1.2.3
git push --tags

# then go to https://github.com/GMOD/dash_jbrowse/tags and select "create
release" from the tag you created

# a github action will then run to create the release on PyPI

```
