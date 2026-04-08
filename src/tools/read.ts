import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCurrentUser, graphql } from "../client.js";
import type { Feature } from "../models/feature.js";
import type { Iteration } from "../models/iteration.js";
import type { Project } from "../models/project.js";
import {
    ITERATION_STATUS,
    QUERY_GET_FEATURES,
    QUERY_GET_FEATURE_COMMENTS,
    QUERY_LIST_ITERATIONS,
    QUERY_LIST_PROJECTS,
    QUERY_SEARCH_DOCUMENTS,
    type FeatureCommentsResponse,
    type FeaturesResponse,
    type IterationsResponse,
    type ProjectsResponse,
    type SearchDocumentsResponse,
} from "../queries.js";

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatFeature(f: Feature, domain: string): string {
  const status = f.workflowStatus.name;
  const meaning = f.workflowStatus.internalMeaning;
  const epicPart = f.epic ? ` · Epic: ${f.epic.referenceNum} ${f.epic.name}` : "";
  const desc = f.description?.markdownBody ?? f.description?.htmlBody ?? "";
  const descPreview = desc.length > 300 ? desc.slice(0, 300).trimEnd() + "…" : desc;
  const tags = f.tags.length ? `Tags: ${f.tags.map((t) => t.name).join(", ")} | ` : "";
  const due = f.dueDate ? `Due: ${f.dueDate} | ` : "";
  const comments = f.commentsCount > 0 ? `Comments: ${f.commentsCount}` : "";
  const url = `https://${domain}.aha.io${f.path}`;

  const lines = [
    `**${f.referenceNum}** · ${status} (${meaning})${epicPart}`,
    f.name,
    descPreview ? `> ${descPreview.replace(/\n/g, " ")}` : "",
    `${tags}${due}${comments}`.replace(/\s*\|\s*$/, "").trim(),
    url,
  ].filter(Boolean);
  return lines.join("\n");
}

function groupByProject(features: Feature[]): Map<string, Feature[]> {
  const map = new Map<string, Feature[]>();
  for (const f of features) {
    const key = `${f.project.name} (${f.project.referencePrefix})`;
    const group = map.get(key) ?? [];
    group.push(f);
    map.set(key, group);
  }
  return map;
}

function iterationLabel(iter: Pick<Iteration, "name" | "startDate" | "endDate">): string {
  return `${iter.name} (${iter.startDate} – ${iter.endDate})`;
}

function progressLabel(iter: Iteration): string {
  const p = iter.iterationProgress;
  if (!p) return "";
  const pct = Math.round(p.byRecordCount);
  return ` · ${pct}% done by record count`;
}

const DOMAIN = process.env.AHA_DOMAIN!;

// ─── Read tool annotations ────────────────────────────────────────────────────

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerReadTools(server: McpServer): void {
  // ── get_me ──────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_me",
    {
      description: "Get the currently authenticated Aha! user (name, email, internal ID).",
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      try {
        const me = await getCurrentUser();
        return {
          content: [
            {
              type: "text",
              text: `Name: ${me.name}\nEmail: ${me.email}\nID: ${me.id}`,
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── list_projects ───────────────────────────────────────────────────────────
  server.registerTool(
    "list_projects",
    {
      description: "List all Aha! projects/workspaces you have access to.",
      inputSchema: {
        page: z.number().int().min(1).default(1).optional().describe("Page number (default 1)"),
        per: z.number().int().min(1).max(200).default(50).optional().describe("Results per page (default 50)"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ page = 1, per = 50 }) => {
      try {
        const data = await graphql<ProjectsResponse>(QUERY_LIST_PROJECTS, { page, per });
        const projects: Project[] = data.projects.nodes;

        if (projects.length === 0) {
          return { content: [{ type: "text", text: "No projects found." }] };
        }

        const header = `Found ${data.projects.totalCount} project(s) (page ${data.projects.currentPage}):`;
        const rows = projects.map((p) => {
          const iterTag = p.iterationsEnabled ? " [sprints]" : "";
          const teamTag = p.isTeam ? " [team]" : "";
          return `• [${p.referencePrefix}] ${p.name}${teamTag}${iterTag}\n  ID: ${p.id}`;
        });

        return { content: [{ type: "text", text: [header, ...rows].join("\n\n") }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── list_iterations ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_iterations",
    {
      description: "List sprint iterations for a project. Filter by status to find the active sprint.",
      inputSchema: {
        projectId: z.string().describe("Project ID (get from list_projects)"),
        status: z
          .enum(["PLANNING", "ACTIVE", "COMPLETE", "ALL"])
          .default("ALL")
          .optional()
          .describe("Filter by iteration status (default ALL)"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ projectId, status = "ALL" }) => {
      try {
        const statusFilter =
          status === "ALL"
            ? undefined
            : [ITERATION_STATUS[status as keyof typeof ITERATION_STATUS]];

        const filters: Record<string, unknown> = { projectId };
        if (statusFilter) filters.status = statusFilter;

        const data = await graphql<IterationsResponse>(QUERY_LIST_ITERATIONS, {
          filters,
          per: 50,
        });

        const iterations: Iteration[] = data.iterations.nodes;
        if (iterations.length === 0) {
          return { content: [{ type: "text", text: "No iterations found." }] };
        }

        const statusName = (s: number) =>
          s === 10 ? "PLANNING" : s === 20 ? "ACTIVE" : "COMPLETE";

        const rows = iterations.map((iter) => {
          const prog = progressLabel(iter);
          return `• [${statusName(iter.status)}] ${iterationLabel(iter)}${prog}\n  ID: ${iter.id}`;
        });

        return {
          content: [
            {
              type: "text",
              text: [`Found ${data.iterations.totalCount} iteration(s):`, ...rows].join("\n\n"),
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── list_features ────────────────────────────────────────────────────────────
  server.registerTool(
    "list_features",
    {
      description: "Query Aha! features with flexible filters. All parameters are optional.",
      inputSchema: {
        projectId: z.string().optional().describe("Filter by project ID"),
        assignedToUserId: z.string().optional().describe("Filter by assigned user ID"),
        iterationId: z.string().optional().describe("Filter by sprint iteration ID"),
        workflowMeaning: z
          .enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "SHIPPED", "WONT_DO", "ALREADY_EXISTS"])
          .optional()
          .describe("Filter by workflow status meaning"),
        page: z.number().int().min(1).default(1).optional().describe("Page number (default 1)"),
        per: z.number().int().min(1).max(100).default(30).optional().describe("Results per page (default 30)"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ projectId, assignedToUserId, iterationId, workflowMeaning, page = 1, per = 30 }) => {
      try {
        const filters: Record<string, unknown> = {};
        if (projectId) filters.projectId = projectId;
        if (assignedToUserId) filters.assignedToUserId = assignedToUserId;
        if (iterationId) filters.iterationId = iterationId;
        if (workflowMeaning) filters.workflowMeaning = [workflowMeaning];

        const data = await graphql<FeaturesResponse>(QUERY_GET_FEATURES, { filters, page, per });
        const features: Feature[] = data.features.nodes;

        if (features.length === 0) {
          return { content: [{ type: "text", text: "No features found." }] };
        }

        const header = `Found ${data.features.totalCount} feature(s) (page ${data.features.currentPage}${data.features.isLastPage ? ", last page" : ""}):`;
        const rows = features.map((f) => formatFeature(f, DOMAIN));

        return { content: [{ type: "text", text: [header, ...rows].join("\n\n---\n\n") }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── get_feature ──────────────────────────────────────────────────────────────
  server.registerTool(
    "get_feature",
    {
      description: "Get full details for a single Aha! feature by its reference number (e.g. DEV-123).",
      inputSchema: {
        referenceNum: z.string().describe("Feature reference number, e.g. DEV-123"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ referenceNum }) => {
      try {
        const data = await graphql<FeaturesResponse>(QUERY_GET_FEATURES, {
          filters: { id: [referenceNum] },
          per: 1,
        });

        const feature = data.features.nodes[0];
        if (!feature) {
          return { content: [{ type: "text", text: `Feature not found: ${referenceNum}` }] };
        }

        const desc = feature.description?.markdownBody ?? feature.description?.htmlBody ?? "(no description)";
        const tags = feature.tags.length ? feature.tags.map((t) => t.name).join(", ") : "none";
        const url = `https://${DOMAIN}.aha.io${feature.path}`;

        const lines = [
          `# ${feature.referenceNum}: ${feature.name}`,
          `**Project:** ${feature.project.name} (${feature.project.referencePrefix})`,
          `**Status:** ${feature.workflowStatus.name} (${feature.workflowStatus.internalMeaning})`,
          feature.teamWorkflowStatus ? `**Team Status:** ${feature.teamWorkflowStatus.name}` : null,
          `**Assigned to:** ${feature.assignedToUser ? `${feature.assignedToUser.name} <${feature.assignedToUser.email}>` : "Unassigned"}`,
          feature.iteration ? `**Iteration:** ${iterationLabel(feature.iteration)}` : "**Iteration:** None",
          `**Release:** ${feature.release.name} (${feature.release.referenceNum})`,
          feature.epic ? `**Epic:** ${feature.epic.referenceNum} — ${feature.epic.name}` : null,
          `**Tags:** ${tags}`,
          feature.startDate ? `**Start date:** ${feature.startDate}` : null,
          feature.dueDate ? `**Due date:** ${feature.dueDate}` : null,
          `**Comments:** ${feature.commentsCount}`,
          `**Created:** ${feature.createdAt}`,
          `**Updated:** ${feature.updatedAt}`,
          `**URL:** ${url}`,
          "",
          "## Description",
          desc,
        ].filter((l): l is string => l !== null);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── get_my_sprint_tickets ────────────────────────────────────────────────────
  server.registerTool(
    "get_my_sprint_tickets",
    {
      description:
        "Get all Aha! features assigned to you in active sprint(s). Optionally scope to a specific project. This is the primary productivity tool — use it to answer 'what are my current sprint tickets?'",
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe("Scope to a specific project (recommended for speed). Get IDs from list_projects."),
        workflowMeaning: z
          .enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "SHIPPED", "WONT_DO", "ALREADY_EXISTS"])
          .optional()
          .describe("Filter tickets by status meaning"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ projectId, workflowMeaning }) => {
      try {
        // Step 1: Resolve current user
        const me = await getCurrentUser();

        // Step 2: Find active iterations
        let activeIterations: Iteration[] = [];

        if (projectId) {
          const data = await graphql<IterationsResponse>(QUERY_LIST_ITERATIONS, {
            filters: { projectId, status: [ITERATION_STATUS.ACTIVE] },
            per: 10,
          });
          activeIterations = data.iterations.nodes;
        } else {
          // Enumerate projects and find active iterations (cap at 20 projects with sprints)
          const projectsData = await graphql<ProjectsResponse>(QUERY_LIST_PROJECTS, { per: 20 });
          const projects: Project[] = projectsData.projects.nodes.filter((p) => p.iterationsEnabled);

          const iterBatches = await Promise.all(
            chunk(projects, 5).map((batch) =>
              Promise.all(
                batch.map((p) =>
                  graphql<IterationsResponse>(QUERY_LIST_ITERATIONS, {
                    filters: { projectId: p.id, status: [ITERATION_STATUS.ACTIVE] },
                    per: 5,
                  }).then((d) => d.iterations.nodes)
                )
              )
            )
          );

          activeIterations = iterBatches.flat(2);
        }

        if (activeIterations.length === 0) {
          const scope = projectId ? "this project" : "any of your projects";
          return {
            content: [
              {
                type: "text",
                text: `No active sprints found in ${scope}. Try list_iterations to see all iterations.`,
              },
            ],
          };
        }

        // Step 3: Fetch features for each active iteration assigned to me
        // projectId is required by the API alongside iterationId
        const featureBatches = await Promise.all(
          activeIterations.map((iter) => {
            const filters: Record<string, unknown> = {
              projectId: iter.project.id,
              iterationId: iter.id,
              assignedToUserId: me.id,
            };
            if (workflowMeaning) filters.workflowMeaning = [workflowMeaning];
            return graphql<FeaturesResponse>(QUERY_GET_FEATURES, { filters, per: 100 }).then(
              (d) => d.features.nodes
            );
          })
        );

        // Step 4: Deduplicate by feature ID
        const seen = new Set<string>();
        const allFeatures: Feature[] = featureBatches.flat().filter((f) => {
          if (seen.has(f.id)) return false;
          seen.add(f.id);
          return true;
        });

        if (allFeatures.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No features assigned to you (${me.name}) in active sprint(s).`,
              },
            ],
          };
        }

        // Step 5: Format grouped by project → iteration
        const iterMap = new Map(activeIterations.map((i) => [i.id, i]));
        const lines: string[] = [
          `## Sprint Tickets for ${me.name} (${allFeatures.length} feature${allFeatures.length !== 1 ? "s" : ""} across ${activeIterations.length} active iteration${activeIterations.length !== 1 ? "s" : ""})`,
        ];

        const byProject = groupByProject(allFeatures);

        for (const [projectLabel, features] of byProject) {
          const byIter = new Map<string, Feature[]>();
          for (const f of features) {
            const key = f.iterationId ?? "__none__";
            const group = byIter.get(key) ?? [];
            group.push(f);
            byIter.set(key, group);
          }

          lines.push(`\n### ${projectLabel}`);

          for (const [iterKey, iterFeatures] of byIter) {
            const iter = iterKey !== "__none__" ? iterMap.get(iterKey) : undefined;
            const iterHeading = iter
              ? `**Sprint: ${iterationLabel(iter)}**${progressLabel(iter)}`
              : "**No iteration**";
            lines.push(`\n${iterHeading}`);

            for (const f of iterFeatures) {
              lines.push(`\n${formatFeature(f, DOMAIN)}`);
            }
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── search_features ──────────────────────────────────────────────────────────
  server.registerTool(
    "search_features",
    {
      description: "Search Aha! features by text. Returns matching features with details.",
      inputSchema: {
        query: z.string().min(1).describe("Search terms"),
        projectId: z.string().optional().describe("Scope to a specific project"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ query, projectId }) => {
      try {
        const filters: Record<string, unknown> = {
          query,
          searchableType: ["Feature"],
        };
        if (projectId) filters.projectId = projectId;

        const searchData = await graphql<SearchDocumentsResponse>(QUERY_SEARCH_DOCUMENTS, {
          filters,
          per: 20,
        });

        const docs = searchData.searchDocuments.nodes;
        if (docs.length === 0) {
          return { content: [{ type: "text", text: `No features found matching "${query}".` }] };
        }

        // Fetch full feature details for the found IDs
        const ids = docs.map((d) => d.searchableId);
        const featureData = await graphql<FeaturesResponse>(QUERY_GET_FEATURES, {
          filters: { id: ids },
          per: ids.length,
        });

        const features = featureData.features.nodes;
        if (features.length === 0) {
          return { content: [{ type: "text", text: `No features found matching "${query}".` }] };
        }

        const header = `Found ${searchData.searchDocuments.totalCount} result(s) for "${query}":`;
        const rows = features.map((f) => formatFeature(f, DOMAIN));

        return { content: [{ type: "text", text: [header, ...rows].join("\n\n---\n\n") }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── get_feature_comments ─────────────────────────────────────────────────────
  server.registerTool(
    "get_feature_comments",
    {
      description:
        "Get all comments on an Aha! feature by its reference number (e.g. DEV-123). Returns comment body, author, and timestamps.",
      inputSchema: {
        referenceNum: z.string().describe("Feature reference number, e.g. DEV-123"),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ referenceNum }) => {
      try {
        const data = await graphql<FeatureCommentsResponse>(QUERY_GET_FEATURE_COMMENTS, {
          filters: { id: [referenceNum] },
        });

        const feature = data.features.nodes[0];
        if (!feature) {
          return { content: [{ type: "text", text: `Feature not found: ${referenceNum}` }] };
        }

        const comments = feature.comments;
        if (comments.length === 0) {
          return { content: [{ type: "text", text: `No comments on ${referenceNum}.` }] };
        }

        const header = `**${referenceNum}** — ${comments.length} comment${comments.length !== 1 ? "s" : ""}:`;
        const rows = comments.map((c) => {
          const bodyPreview =
            c.body.length > 500 ? c.body.slice(0, 500).trimEnd() + "…" : c.body;
          return [
            `**${c.user.name}** <${c.user.email}> · ${c.createdAt}`,
            bodyPreview,
          ].join("\n");
        });

        return { content: [{ type: "text", text: [header, ...rows].join("\n\n---\n\n") }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
