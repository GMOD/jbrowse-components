---
name: agent-evals
description: How the two agent evals grade the jb surface, what selfCheck proves about a grader, the held-out split, and the route report that says which briefed jb members agents reach. Read before changing jb, jb.help or the agent docs, or adding an eval task.
audience: internal
kind: operations
---

# Agent evals

Two evals run a real `claude -p` session per task and grade the **session
state** afterwards, never the transcript:

- `pnpm --filter @jbrowse/desktop eval:mcp` drives JBrowse Desktop over its MCP
  server (`products/jbrowse-desktop/test/mcpAgentEval.ts`).
- `scripts/agent-evals/webAgentEval.ts` drives JBrowse Web through Claude in
  Chrome.

Tasks live in `scripts/agent-evals/tasks.ts`, all against the volvox baseline.

## A grader has to be proven before an agent meets it

`pnpm check-eval-graders` needs a `jbrowse-web` build and no agent. For each
task it stages the baseline, requires the grader to fail the untouched state,
then runs the task's `solution` and requires the grader to pass. It caught
three defects in its first run: `navigate-gene` passed the baseline (the
baseline already showed EDEN in a 30 kb window, so any agent that did nothing
passed), `add-bigwig` cannot pass on Web (`desktopOnly` now), and a decline
regex too narrow for its own correct answer.

A task without a `solution` is checked against the baseline only.

## Sets

`--set dev` (default) runs the tasks the docs were tuned against. `--set
heldout` runs tasks marked `heldOut`, phrased apart from the docs. Run them to
read the dev score against; do not tune `jb.help` or the live-model guide on
them, or they become dev tasks.

A negative task passes by declining: `nonexistent-track` and `unknown-setting`
fail an agent that invents a track or reports a setting it could not write.

## The route report

Each desktop run records which briefed routes its `run_javascript` code named.
The routes come from the live object (`Object.keys(jb)`) and from every
`jb.x`, `view.x`, `track.x`, `session.x` and `activeDisplay.x` in `jb.help`
(`scripts/agent-evals/jbUsage.ts`), so a route added to either is measured with
no list kept beside them. The summary prints calls, errors and the pass/fail
split per route, then the routes no run reached.

A route no task reaches needs a task before it needs a verdict. A route every
task can do without, once the suite covers the briefing, is a cut candidate,
and the test of the cut is the eval: hide the route and compare pass rate,
turns and dollars, not characters removed.

## Reading more than one run

`--runs N` prints `passes/runs` per task and how many tasks passed every run.
One run per task hides a 75% task: three passes in a row happen about 42% of the
time at that rate.

## The agents that count

The target is sonnet and opus at their best, so a weaker model is not the
yardstick and a fix that only a weak model needs is not wanted. When the dev
set saturates on sonnet, add harder tasks rather than a weaker model. A
workaround in `jb` that exists because an agent stumbled is evidence to test,
not a fixture: hide it and compare pass rate, turns and dollars on opus and
sonnet. `agent-docs/ideas/ready/ablate-the-jb-spellings-agents-stumbled-on.md`
lists the two to try first.
