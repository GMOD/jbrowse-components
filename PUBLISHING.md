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

Once the draft release has been created (you can look for it
[here](https://github.com/GMOD/jbrowse-components/releases)), go to the release
and click "Edit," then add a description to the release. Usually you can copy
the content of the blog post that was generated (it will be named something like
`website/blog/${DATE}-${RELEASE_TAG}-release.md`), removing the "Downloads"
section.

Note also that I edit the .prettierrc.json file to change "proseWrap":"always"
to "proseWrap":"never", format the blogpost, then copy to the github release,
because they make markdown newlines into actual newlines in these release notes

### Step 5. Update embedded demos

Finally, update the embedded demos using some bash scripts. This is not fully
automated, but you can run each step and check that there aren't any errors

```bash
cd embedded_demos
./clone_demos.sh # clones embedded demo repos to local folder
./update_demos.sh # runs yarn upgrade in each embedded demo to get latest jbrowse code
./deploy_demos.sh # runs build and uploads to amazon s3 bucket
./push_demos.sh # pushes updated yarn.locks to the github repos so consumers get same lock file
```

Then you can manually check e.g. https://jbrowse.org/demos/lgv and see that the
"About" dialog says the updated version

Note that the deploy step requires that you have the AWS CLI tools, and have
authenticated with the jbrowse.org account
