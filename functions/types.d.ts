interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results: T[];
  meta: {
    duration: number;
    changes: number;
    changed_db: boolean;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
    size_after: number;
    served_by?: string;
  };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | T[keyof T] | null>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

interface D1DatabaseSession {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
  getBookmark(): string | null;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
  exec(query: string): Promise<D1ExecResult>;
  withSession(bookmarkOrConstraint?: string): D1DatabaseSession;
}

interface EventContext<Env = unknown, Params extends string = string, Data = unknown> {
  request: Request;
  env: Env;
  params: Record<Params, string | string[] | undefined> & Record<string, string | string[] | undefined>;
  data: Data;
  functionPath: string;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
}

type PagesFunction<Env = unknown, Params extends string = string, Data = unknown> = (
  context: EventContext<Env, Params, Data>
) => Response | Promise<Response>;
