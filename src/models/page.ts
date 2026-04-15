/** Aha! "page" — called "notes" in the UI. Returned by the REST v1 API. */
export interface AhaPage {
  id: string;
  name: string;
  title: string;
  reference_num: string;
  document_type_name: string;
  created_at: string;
  updated_at: string;
  url: string;
  resource: string;
  parent_id: string | null;
  comments_count: number;
  description?: {
    id: string;
    body: string;
  };
  workflow_status?: {
    id: string;
    name: string;
    color: string;
  };
  tags?: { name: string }[];
}
