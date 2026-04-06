export interface Note {
  markdownBody: string | null;
  htmlBody: string | null;
}

export interface Tag {
  name: string;
}

export interface Estimate {
  value: number | null;
  units: string | null;
  text: string | null;
}

export interface PageInfo {
  currentPage: number;
  isLastPage: boolean;
  totalCount: number;
}

export interface Page<T> extends PageInfo {
  nodes: T[];
}
