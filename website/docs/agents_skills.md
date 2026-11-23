---
title: Agent skills for JBrowse
sidebar_label: Skills
description:
  The agent skills the JBrowse repository keeps, what each one briefs an agent
  on, and how to install them in Claude Code, Codex or another agent that reads
  SKILL.md folders
---

The JBrowse repository keeps
[agent skills](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills),
folders with a `SKILL.md` that brief a coding agent before it writes a config,
picks hosted data, renders a view or drives JBrowse Desktop. The agent loads a
skill when a task matches its description, so after installing them you ask in
plain words.

| Skill                                                                                                          | Use it to                                                      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [jbrowse-authoring](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-authoring)     | write a config or session spec and check it with the validator |
| [jbrowse-hosted-data](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-hosted-data) | find a hosted assembly and its tracks                          |
| [jbrowse-capture](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-capture)         | render a view to an image and know when it finished drawing    |
| [jbrowse-mcp](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-mcp)                 | drive JBrowse Desktop through its [MCP server](/docs/agents)   |

## Install

An agent with a shell can install them itself; ask it:

```text
Install the jbrowse-authoring, jbrowse-hosted-data, jbrowse-capture and
jbrowse-mcp skills from
https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills
into my skills folder
```

To install by hand, copy each folder into your agent's skills folder:

- Claude Code: `~/.claude/skills/`
- Codex: `~/.codex/skills/`
- another agent that reads `SKILL.md` folders: the folder its docs name

In JBrowse Web or Desktop, **Help → Connect an AI agent...** copies a
command-line prompt that points the agent at the same skills.

## See also

- [](/docs/agents_authoring), the loop the first three skills brief
- [](/docs/agents_capture), the two render tools behind jbrowse-capture
- [](/docs/agents_hosted_data), the genomes jbrowse-hosted-data searches
