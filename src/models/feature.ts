import type { Note, Tag, Estimate } from "./common.js";
import type { User } from "./user.js";
import type { WorkflowStatus } from "./workflow.js";
import type { Project } from "./project.js";
import type { Iteration } from "./iteration.js";

export interface Release {
  id: string;
  name: string;
  referenceNum: string;
}

export interface Epic {
  id: string;
  name: string;
  referenceNum: string;
}

export interface Feature {
  id: string;
  referenceNum: string;
  name: string;
  description: Note | null;
  assignedToUser: User | null;
  workflowStatus: WorkflowStatus;
  teamWorkflowStatus: WorkflowStatus | null;
  iteration: Iteration | null;
  iterationId: string | null;
  release: Release;
  releaseId: string;
  project: Project;
  epic: Epic | null;
  tags: Tag[];
  tagList: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  path: string;
  commentsCount: number;
  initialEstimate: Estimate | null;
  remainingEstimate: Estimate | null;
}
