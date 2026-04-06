# Aha! GraphQL Schema Summary

Summary of the Aha! GraphQL API relevant to this MCP server. Derived from introspection of `graphql_spec.json`.

**Endpoint:** `https://{AHA_DOMAIN}.aha.io/api/v2/graphql`  
**Auth:** `Authorization: Bearer {AHA_API_TOKEN}`

> Note: There is no `me` or `currentUser` GraphQL query. Use the REST API (`GET /api/v1/me`) to resolve the current user.

---

## Root Query Types

| Query | Args | Returns | Description |
|---|---|---|---|
| `account` | `id?` | `Account!` | Current account info |
| `features` | `filters: FeatureFilters!`, `order?`, `page?`, `per?` | `FeaturePage!` | List features with filters |
| `iterations` | `filters: IterationFilters!`, `order?`, `page?`, `per?` | `IterationPage!` | List sprint iterations |
| `projects` | `page?`, `per?` | `ProjectPage!` | List projects/workspaces |
| `users` | `filters: UserFilters!`, `page?`, `per?` | `UserPage!` | List users for a project |
| `searchDocuments` | `filters: SearchDocumentFilters!`, `page?`, `per?` | `SearchDocumentPage!` | Full-text search |

---

## Root Mutation Types

| Mutation | Key Args | Returns |
|---|---|---|
| `createFeature` | `attributes: FeatureAttributes!` | `{ feature: Feature }` |
| `updateFeature` | `id: ID!`, `attributes: FeatureAttributes!` | `{ feature: Feature }` |
| `deleteFeature` | `id: ID!` | `{ feature: Feature }` |
| `createComment` | `attributes: CommentAttributes!` | `{ comment: Comment }` |
| `createIteration` | `attributes: IterationAttributes!` | `{ iteration: Iteration }` |
| `updateIteration` | `id: ID!`, `attributes: IterationAttributes!` | `{ iteration: Iteration }` |
| `completeIteration` | `id: ID!` | `{ iteration: Iteration }` |
| `setCustomFieldValue` | various | various |

---

## Key Types

### Feature

The primary work item in Aha!.

| Field | Type | Notes |
|---|---|---|
| `id` | `ID!` | Opaque internal ID |
| `referenceNum` | `String!` | Human-readable, e.g. `DEV-123` |
| `name` | `String!` | Feature title |
| `description` | `Note!` | Use `markdownBody` or `htmlBody` (may be null) |
| `assignedToUser` | `User` | Assigned user (nullable) |
| `assignedToUserId` | `ID` | Assigned user's ID |
| `workflowStatus` | `WorkflowStatus!` | Current status |
| `teamWorkflowStatus` | `WorkflowStatus` | Team-level status (nullable) |
| `iteration` | `Iteration` | Sprint iteration (nullable) |
| `iterationId` | `ID` | |
| `release` | `Release!` | Associated release |
| `releaseId` | `ID!` | |
| `project` | `Project!` | Owning project |
| `epic` | `Epic` | Parent epic (nullable) |
| `tags` | `[Tag!]!` | Tags list |
| `tagList` | `String!` | Comma-separated tag names |
| `startDate` | `ISO8601Date` | |
| `dueDate` | `ISO8601Date` | |
| `createdAt` | `ISO8601DateTime!` | |
| `updatedAt` | `ISO8601DateTime!` | |
| `path` | `String!` | URL path on Aha! |
| `commentsCount` | `Int!` | |
| `initialEstimate` | `Estimate` | |
| `remainingEstimate` | `Estimate` | |

### FeatureFilters

All fields optional.

| Field | Type | Notes |
|---|---|---|
| `id` | `[ID!]` | List of IDs or reference numbers |
| `projectId` | `ID` | Filter by project |
| `teamId` | `ID` | Filter by team |
| `iterationId` | `ID` | Filter by sprint iteration |
| `releaseId` | `ID` | Filter by release |
| `assignedToUserId` | `ID` | Filter by assigned user |
| `workflowMeaning` | `[WorkflowMeaningEnum!]` | Filter by status meaning |
| `active` | `Boolean` | Active releases only |

### Iteration (Sprint)

| Field | Type | Notes |
|---|---|---|
| `id` | `ID!` | |
| `name` | `String!` | |
| `startDate` | `ISO8601Date!` | |
| `endDate` | `ISO8601Date!` | |
| `status` | `Int!` | 10=PLANNING, 20=ACTIVE, 30=COMPLETE |
| `duration` | `Int!` | Duration in days |
| `goal` | `String` | Sprint goal |
| `project` | `Project!` | |
| `iterationProgress` | `IterationProgress!` | Progress tracking |
| `path` | `String!` | |

### IterationFilters

| Field | Type | Notes |
|---|---|---|
| `projectId` | `ID` | Optional in schema; may be required in practice |
| `id` | `[ID!]` | |
| `status` | `[Int!]` | 10=PLANNING, 20=ACTIVE, 30=COMPLETE |
| `createdAfter` | `ISO8601DateTime` | |

### Project

| Field | Type | Notes |
|---|---|---|
| `id` | `ID!` | |
| `name` | `String!` | |
| `referencePrefix` | `String!` | e.g. `DEV` |
| `workspaceType` | `String` | |
| `isTeam` | `Boolean!` | |
| `iterationsEnabled` | `Boolean!` | Whether sprints are enabled |
| `users` | `[User!]!` | Users in this project |

### User

| Field | Type |
|---|---|
| `id` | `ID!` |
| `name` | `String!` |
| `email` | `String!` |

### UserFilters

| Field | Type | Notes |
|---|---|---|
| `projectId` | `ID` | |
| `id` | `[ID!]` | |
| `includeAll` | `Boolean` | Include users from parent hierarchy |

> ⚠️ No email filter — cannot look up users by email via GraphQL. Use REST `GET /api/v1/me` to get the current user.

### WorkflowStatus

| Field | Type | Notes |
|---|---|---|
| `id` | `ID!` | |
| `name` | `String!` | Display name |
| `color` | `String!` | Hex color |
| `internalMeaning` | `InternalMeaning!` | See enum below |

### InternalMeaning (enum)

Maps workflow statuses to semantic meanings:
- `NOT_STARTED`
- `IN_PROGRESS`
- `DONE`
- `SHIPPED`
- `WONT_DO`
- `ALREADY_EXISTS`

### WorkflowMeaningEnum

Used as a filter value (same values as InternalMeaning):
`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `SHIPPED`, `WONT_DO`, `ALREADY_EXISTS`

### Note

The `description` field on Feature (and other types) returns a `Note` object:

| Field | Type | Notes |
|---|---|---|
| `markdownBody` | `String` | Nullable — prefer this for LLM context |
| `htmlBody` | `String` | Nullable — fallback |

### FeatureAttributes (for mutations)

| Field | Type | Notes |
|---|---|---|
| `name` | `String` | |
| `description` | `String` | HTML string |
| `workflowStatus` | `WorkflowStatusRelationshipInput` | `{ id, name?, category? }` |
| `project` | `ProjectRelationshipInput` | `{ id }` |
| `release` | `ReleaseRelationshipInput` | `{ id }` |
| `assignedToUser` | `UserRelationshipInput` | `{ id }` |
| `iteration` | `IterationRelationshipInput` | `{ id }` |

### CommentAttributes (for createComment mutation)

| Field | Type | Notes |
|---|---|---|
| `commentable` | `CommentableInput!` | `{ id: ID!, typename: CommentableTypeEnum! }` |
| `body` | `String!` | HTML content |

`CommentableTypeEnum` — must be the string `"Feature"` (or other type names like `"Epic"`, `"Requirement"`, etc.)

---

## Pagination Pattern

All list queries use offset-based pagination:

```graphql
query {
  features(filters: {...}, page: 1, per: 30) {
    currentPage
    isLastPage
    totalCount
    nodes { ... }
  }
}
```

Paginate by incrementing `page` until `isLastPage` is `true`.

---

## REST API (used for current user)

**Endpoint:** `GET https://{AHA_DOMAIN}.aha.io/api/v1/me`  
**Auth:** `Authorization: Bearer {AHA_API_TOKEN}`

Response shape:
```json
{
  "user": {
    "id": "...",
    "name": "Kieran Gookey",
    "email": "kieran@example.com"
  }
}
```

This is the only REST endpoint used by this MCP server.
