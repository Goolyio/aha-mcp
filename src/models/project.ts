export interface Project {
  id: string;
  name: string;
  referencePrefix: string;
  workspaceType: string | null;
  isTeam: boolean;
  iterationsEnabled: boolean;
}
