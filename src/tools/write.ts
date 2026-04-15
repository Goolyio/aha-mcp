import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { graphql, resolveFeatureId, restPost, restPut } from "../client.js";
import type { AhaPage } from "../models/page.js";
import {
    MUTATION_ADD_COMMENT,
    MUTATION_CREATE_FEATURE,
    MUTATION_UPDATE_FEATURE,
    type CreateCommentResponse,
    type CreateFeatureResponse,
    type UpdateFeatureResponse,
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

  // ── create_note ──────────────────────────────────────────────────────────────
  server.registerTool(
    "create_note",
    {
      description:
        "⚠️ WRITE OPERATION: Create a new note (knowledge base page) in an Aha! product. Requires a product reference prefix (e.g. 'DAI') or numeric product ID.",
      inputSchema: {
        productId: z
          .string()
          .describe("Product reference prefix (e.g. 'DAI') or numeric product ID (from list_projects)"),
        name: z.string().min(1).describe("Note title"),
        body: z
          .string()
          .optional()
          .describe("Note body as HTML, e.g. '<p>My note content</p>' (optional)"),
        parentId: z
          .string()
          .optional()
          .describe("ID of a parent page or folder to nest this note under (optional)"),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ productId, name, body, parentId }) => {
      try {
        const page: Record<string, unknown> = { name };
        if (body) page.description_attributes = { body };
        if (parentId) page.parent_id = parentId;

        const data = await restPost<{ page: AhaPage }>(
          `/api/v1/products/${encodeURIComponent(productId)}/pages`,
          { page }
        );

        const p = data.page;
        return {
          content: [
            {
              type: "text",
              text: `Created note ${p.reference_num}: ${p.name}\nID: ${p.id}\nURL: ${p.url}`,
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );

  // ── update_note ──────────────────────────────────────────────────────────────
  server.registerTool(
    "update_note",
    {
      description:
        "⚠️ WRITE OPERATION: Update an existing Aha! note (knowledge base page). Accepts a numeric ID or reference number (e.g. DAI-N-782). All fields are optional — only provided fields are updated.",
      inputSchema: {
        noteId: z.string().describe("Numeric ID or reference number of the note (e.g. DAI-N-782)"),
        name: z.string().optional().describe("New note title (optional)"),
        body: z
          .string()
          .optional()
          .describe("New note body as HTML, e.g. '<p>Updated content</p>' (optional)"),
        parentId: z
          .string()
          .optional()
          .describe("ID of a parent page or folder to move this note under (optional)"),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ noteId, name, body, parentId }) => {
      try {
        const page: Record<string, unknown> = {};
        if (name) page.name = name;
        if (body) page.description_attributes = { body };
        if (parentId) page.parent_id = parentId;

        if (Object.keys(page).length === 0) {
          return { isError: true, content: [{ type: "text", text: "No fields to update. Provide at least one of: name, body, parentId." }] };
        }

        const data = await restPut<{ page: AhaPage }>(
          `/api/v1/pages/${encodeURIComponent(noteId)}`,
          { page }
        );

        const p = data.page;
        return {
          content: [
            {
              type: "text",
              text: `Updated note ${p.reference_num}: ${p.name}\nID: ${p.id}\nURL: ${p.url}`,
            },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e) }] };
      }
    }
  );
}
