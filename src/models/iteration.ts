import type { Project } from "./project.js";

export enum IterationStatus {
  PLANNING = 10,
  ACTIVE = 20,
  COMPLETE = 30,
}

export interface IterationProgress {
  // Float scalars: 0.0 (0%) to 1.0 (100%) progress
  byRecordCount: number;
  byOriginalEstimate: number;
  byRemainingEstimate: number;
}

export interface Iteration {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: IterationStatus;
  duration: number;
  goal: string | null;
  project: Project;
  iterationProgress: IterationProgress | null;
  path: string;
}
