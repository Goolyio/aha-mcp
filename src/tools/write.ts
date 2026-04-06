import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { graphql, resolveFeatureId } from "../client.js";
import {
  MUTATION_UPDATE_FEATURE,
  MUTATION_ADD_COMMENT,
  MUTATION_CREATE_FEATURE,
  type UpdateFeatureResponse,
  type CreateCommentResponse,
  type CreateFeatureResponse,
} from "../queries.js";

// ─── Write tool annotations ───────────────────────────────────────────────────

const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerWriteTools(server: McpServer): void {
  // ── update_feature_status ────────────────────────────────────────────────────
  server.registerTool(
    "update_feature_status",
    {
      description:
        "⚠️ WRITE OPERATION: Update the workflow status of an Aha! feature. Accepts a reference number (e.g. DEV-123) or internal ID. Get valid workflow status IDs from get_feature.",
      inputSchema: {
        featureId: z.string().describe("Feature reference number (e.g. DEV-123) or internal ID"),
        workflowStatusId: z
          .string()
          .describe("Target workflow status ID (get from get_feature → workflowStatus.id)"),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ featureId, workflowStatusId }) => {
      try {
        const internalId = await resolveFeatureId(featureId);
        const data = await graphql<UpdateFeatureResponse>(MUTATION_UPDATE_FEATURE, {
          id: internalId,
          workflowStatusId,
        });

        const f = data.updateFeature.feature;
        return {
          content: [
            {
              type: "text",
              text: `Updated ${f.referenceNum}: status is now "${f.workflowStatus.name}" (${f.workflowStatus.internalMeaning})`,
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── add_feature_comment ──────────────────────────────────────────────────────
  server.registerTool(
    "add_feature_comment",
    {
      description:
        "⚠️ WRITE OPERATION: Post a comment on an Aha! feature. Accepts a reference number (e.g. DEV-123) or internal ID. Body supports HTML.",
      inputSchema: {
        featureId: z.string().describe("Feature reference number (e.g. DEV-123) or internal ID"),
        body: z
          .string()
          .min(1)
          .describe("Comment body. Plain text or HTML (e.g. '<p>My comment</p>')"),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ featureId, body }) => {
      try {
        const internalId = await resolveFeatureId(featureId);
        const data = await graphql<CreateCommentResponse>(MUTATION_ADD_COMMENT, {
          featureId: internalId,
          body,
        });

        const comment = data.createComment.comment;
        return {
          content: [
            {
              type: "text",
              text: `Comment posted (ID: ${comment.id}, created: ${comment.createdAt})`,
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── create_feature ───────────────────────────────────────────────────────────
  server.registerTool(
    "create_feature",
    {
      description:
        "⚠️ WRITE OPERATION: Create a new feature in Aha!. Requires a project and release to associate with. Get project IDs from list_projects.",
      inputSchema: {
        projectId: z.string().describe("Project ID to create the feature in (from list_projects)"),
        name: z.string().min(1).describe("Feature title"),
        releaseId: z.string().describe("Release ID to associate the feature with"),
        assignedToUserId: z
          .string()
          .optional()
          .describe("User ID to assign the feature to (optional)"),
        description: z
          .string()
          .optional()
          .describe("Feature description as HTML, e.g. '<p>My description</p>' (optional)"),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ projectId, name, releaseId, assignedToUserId, description }) => {
      try {
        const variables: Record<string, unknown> = { name, projectId, releaseId };
        if (assignedToUserId) variables.assignedToUserId = assignedToUserId;
        if (description) variables.description = description;

        const data = await graphql<CreateFeatureResponse>(MUTATION_CREATE_FEATURE, variables);
        const f = data.createFeature.feature;
        const url = `https://${process.env.AHA_DOMAIN!}.aha.io${f.path}`;

        return {
          content: [
            {
              type: "text",
              text: `Created feature ${f.referenceNum}\nID: ${f.id}\nURL: ${url}`,
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );
}
