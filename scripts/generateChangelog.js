const { Octokit } = require("@octokit/rest");

async function getMergedPullRequestsBetweenTags(
  owner,
  repo,
  tagA,
  tagB,
  githubToken
) {
  const octokit = new Octokit({ auth: githubToken });
  const mergedPRs = new Map(); // Use a Map to store unique PRs by their ID

  try {
    // 1. Get the comparison between the two tags to find all commits in the range
    // Note: tagA should be the older tag, tagB the newer one.
    // The '...' (three dots) notation means commits reachable from tagB but not from tagA.
    const compareResponse = await octokit.repos.compareCommits({
      owner,
      repo,
      base: tagA,
      head: tagB,
    });

    const commits = compareResponse.data.commits;

    if (!commits || commits.length === 0) {
      return [];
    }

    // 2. For each commit, find associated pull requests
    for (const commit of commits) {
      try {
        const prsForCommitResponse = await octokit.repos.listPullRequestsAssociatedWithCommit({
          owner,
          repo,
          commit_sha: commit.sha,
        });

        // 3. Filter for merged pull requests and add to our unique list
        for (const pr of prsForCommitResponse.data) {
          // A PR is considered merged if it has a 'merged_at' timestamp
          if (pr.merged_at) {
            if (!mergedPRs.has(pr.id)) {
              mergedPRs.set(pr.id, {
                number: pr.number,
                title: pr.title,
                html_url: pr.html_url,
                merged_at: pr.merged_at,
                user: pr.user.login,
              });
            }
          }
        }
      } catch (commitPrError) {
        // Continue to the next commit even if one fails
      }
    }

    return Array.from(mergedPRs.values());
  } catch (error) {
    throw error;
  }
}

async function main() {
  const [owner, repo, tagA, tagB, githubToken] = process.argv.slice(2);

  if (!owner || !repo || !tagA || !tagB || !githubToken) {
    console.error("Usage: node generateChangelog.js <owner> <repo> <tagA> <tagB> <githubToken>");
    process.exit(1);
  }

  try {
    const prs = await getMergedPullRequestsBetweenTags(owner, repo, tagA, tagB, githubToken);
    prs.sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at)); // Sort by merge date

    let changelog = "";
    if (prs.length > 0) {
      prs.forEach((pr) => {
        changelog += `- #${pr.number}: ${pr.title} (by @${pr.user}) [${new Date(pr.merged_at).toLocaleDateString()}](${pr.html_url})\n`;
      });
    } else {
      changelog = "No merged pull requests found in the specified range.\n";
    }
    console.log(changelog);
  } catch (error) {
    console.error(`Error generating changelog: ${error.message}`);
    process.exit(1);
  }
}

main();
