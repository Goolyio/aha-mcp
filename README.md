# aha-mcp

An MCP (Model Context Protocol) server for [Aha!](https://www.aha.io) focused on **productivity and LLM context**. Give your AI assistant direct access to your Aha! tickets so you can ask things like:

> *"What are my current sprint tickets?"*
> *"Show me what's in progress in DAI"*
> *"Find the ticket about the jailbreak issue"*

---

## Installation

Requires Node.js 18+ or Bun 1.0+.

### Claude Desktop (recommended)

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aha": {
      "command": "npx",
      "args": ["-y", "@goolyio_k/aha-mcp"],
      "env": {
        "AHA_API_TOKEN": "your_api_token",
        "AHA_DOMAIN": "yourcompany"
      }
    }
  }
}
```

Restart Claude Desktop — the Aha! tools will appear automatically.

### Other MCP clients

Any client that supports the MCP stdio transport can run:

```bash
npx @goolyio_k/aha-mcp
```

with `AHA_API_TOKEN` and `AHA_DOMAIN` set in the environment.

---

## Getting your credentials

| Variable | Where to find it |
|---|---|
| `AHA_API_TOKEN` | Aha! → Profile → Security → **Developer API keys** → Generate token |
| `AHA_DOMAIN` | Your Aha! subdomain — e.g. if you access `acme.aha.io`, use `acme` |

---

## Tools

### Read tools

| Tool | Description |
|---|---|
| `get_my_sprint_tickets` | **Start here.** All features assigned to you in active sprint(s), grouped by project. |
| `get_my_features` | All features assigned to you across all projects, with optional filters. |
| `get_me` | Who am I — resolves the authenticated user's name, email, and ID. |
| `list_projects` | List all Aha! workspaces/projects you have access to. |
| `list_iterations` | List sprints for a project, filterable by status (PLANNING / ACTIVE / COMPLETE). |
| `list_features` | Flexible feature querying — filter by project, user, sprint, status, or any combination. |
| `get_feature` | Full detail on a single feature by reference number, e.g. `DAI-1048`. |
| `get_feature_comments` | Get all comments on a feature by reference number. |
| `search_features` | Full-text search across features. |

### Write tools ⚠️

These modify data in Aha! and are clearly marked so your AI assistant treats them carefully.

| Tool | Description |
|---|---|
| `update_feature_status` | Change a feature's workflow status. |
| `add_feature_comment` | Post a comment on a feature. |
| `create_feature` | Create a new feature in a project. |

---

## Example prompts

Once connected, try asking Claude:

- *"What are my tickets for this sprint?"*
- *"Show me everything in progress in the AI Team project"*
- *"Get the details for DAI-1048"*
- *"Search for tickets about jailbreak"*
- *"What sprints are active in the AI Team project?"*
- *"Add a comment to DAI-1007 saying I've started investigating"* ⚠️

---

## Architecture

```
src/
├── index.ts         # MCP server entry point (STDIO transport)
├── client.ts        # GraphQL + REST HTTP client, user caching
├── queries.ts       # All GraphQL query/mutation strings
├── models/          # TypeScript interfaces for Aha! domain models
│   ├── common.ts    # Note, PageInfo, Tag, Estimate
│   ├── user.ts      # User
│   ├── workflow.ts  # WorkflowStatus, InternalMeaning enum
│   ├── project.ts   # Project
│   ├── iteration.ts # Iteration, IterationStatus enum
│   └── feature.ts   # Feature
└── tools/
    ├── read.ts      # Read-only tool implementations
    └── write.ts     # Mutation tool implementations
```

See [docs/graphql-schema.md](docs/graphql-schema.md) for a full summary of the Aha! GraphQL API schema used by this server.
