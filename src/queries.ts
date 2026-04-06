import type { Feature } from "./models/feature.js";
import type { Iteration } from "./models/iteration.js";
import type { Project } from "./models/project.js";
import type { Page } from "./models/common.js";

// ─── Status Constants ───────────────────────────────────────────────────────

export const ITERATION_STATUS = {
  PLANNING: 10,
  ACTIVE: 20,
  COMPLETE: 30,
} as const;

// ─── Response Types ──────────────────────────────────────────────────────────

export interface FeaturesResponse {
  features: Page<Feature>;
}

export interface IterationsResponse {
  iterations: Page<Iteration>;
}

export interface ProjectsResponse {
  projects: Page<Project>;
}

export interface SearchDocument {
  name: string;
  searchableId: string;
  searchableType: string;
  url: string;
  project: { id: string; name: string; referencePrefix: string } | null;
}

export interface SearchDocumentsResponse {
  searchDocuments: Page<SearchDocument>;
}

export interface UpdateFeatureResponse {
  updateFeature: { feature: Pick<Feature, "id" | "referenceNum" | "workflowStatus"> };
}

export interface CreateCommentResponse {
  createComment: { comment: { id: string; createdAt: string } };
}

export interface CreateFeatureResponse {
  createFeature: { feature: Pick<Feature, "id" | "referenceNum" | "path"> };
}

// ─── Feature Fragment ────────────────────────────────────────────────────────

const FEATURE_FIELDS = `
  id
  referenceNum
  name
  description { markdownBody htmlBody }
  assignedToUser { id name email }
  workflowStatus { id name color internalMeaning }
  teamWorkflowStatus { id name }
  iteration { id name startDate endDate status }
  iterationId
  release { id name referenceNum }
  releaseId
  project { id name referencePrefix workspaceType isTeam iterationsEnabled }
  epic { id name referenceNum }
  tags { name }
  tagList
  startDate
  dueDate
  createdAt
  updatedAt
  path
  commentsCount
`;

// ─── Queries ─────────────────────────────────────────────────────────────────

export const QUERY_GET_FEATURES = `
  query GetFeatures($filters: FeatureFilters!, $page: Int, $per: Int) {
    features(filters: $filters, page: $page, per: $per) {
      currentPage
      isLastPage
      totalCount
      nodes {
        ${FEATURE_FIELDS}
      }
    }
  }
`;

export const QUERY_LIST_ITERATIONS = `
  query ListIterations($filters: IterationFilters!, $page: Int, $per: Int) {
    iterations(filters: $filters, page: $page, per: $per) {
      currentPage
      isLastPage
      totalCount
      nodes {
        id
        name
        startDate
        endDate
        status
        duration
        goal
        project { id name referencePrefix }
        iterationProgress {
          byRecordCount
          byOriginalEstimate
        }
        path
      }
    }
  }
`;

export const QUERY_LIST_PROJECTS = `
  query ListProjects($page: Int, $per: Int) {
    projects(page: $page, per: $per) {
      currentPage
      isLastPage
      totalCount
      nodes {
        id
        name
        referencePrefix
        workspaceType
        isTeam
        iterationsEnabled
      }
    }
  }
`;

export const QUERY_SEARCH_DOCUMENTS = `
  query SearchDocuments($filters: SearchDocumentFilters!, $page: Int, $per: Int) {
    searchDocuments(filters: $filters, page: $page, per: $per) {
      currentPage
      isLastPage
      totalCount
      nodes {
        name
        searchableId
        searchableType
        url
        project { id name referencePrefix }
      }
    }
  }
`;

// ─── Mutations ───────────────────────────────────────────────────────────────

export const MUTATION_UPDATE_FEATURE = `
  mutation UpdateFeature($id: ID!, $workflowStatusId: ID!) {
    updateFeature(
      id: $id
      attributes: { workflowStatus: { id: $workflowStatusId } }
    ) {
      feature {
        id
        referenceNum
        workflowStatus { id name internalMeaning }
      }
    }
  }
`;

export const MUTATION_ADD_COMMENT = `
  mutation AddComment($featureId: ID!, $body: String!) {
    createComment(
      attributes: {
        commentable: { id: $featureId, typename: Feature }
        body: $body
      }
    ) {
      comment {
        id
        createdAt
      }
    }
  }
`;

export const MUTATION_CREATE_FEATURE = `
  mutation CreateFeature(
    $name: String!
    $projectId: ID!
    $releaseId: ID!
    $assignedToUserId: ID
    $description: String
  ) {
    createFeature(
      attributes: {
        name: $name
        project: { id: $projectId }
        release: { id: $releaseId }
        assignedToUser: { id: $assignedToUserId }
        description: $description
      }
    ) {
      feature {
        id
        referenceNum
        path
      }
    }
  }
`;
