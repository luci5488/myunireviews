import { Request } from 'express';

export type UserRole = 'student' | 'moderator' | 'admin';

export interface JwtPayload {
  id: number;
  role: UserRole;
  tv: number;  // token_version — increment to revoke all existing tokens
  rm?: boolean; // remember_me — controls whether the session cookie is persistent
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  details?: unknown;
}
