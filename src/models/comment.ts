import type { User } from "./user.js";

export interface Comment {
  id: string;
  body: string;
  user: User;
  createdAt: string;
  updatedAt: string;
}
