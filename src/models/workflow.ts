export enum InternalMeaning {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  SHIPPED = "SHIPPED",
  WONT_DO = "WONT_DO",
  ALREADY_EXISTS = "ALREADY_EXISTS",
}

// WorkflowMeaningEnum mirrors InternalMeaning — used as a filter value
export type WorkflowMeaningEnum = InternalMeaning;

export interface WorkflowStatus {
  id: string;
  name: string;
  color: string;
  internalMeaning: InternalMeaning;
}
