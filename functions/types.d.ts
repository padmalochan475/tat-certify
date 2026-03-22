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

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
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

// Cloudflare R2 Types
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: R2PutOptions): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
  head(key: string): Promise<R2Object | null>;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  range?: R2Range;
  checksums?: R2Checksums;
  body?: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
  sha1?: ArrayBuffer | string;
  sha256?: ArrayBuffer | string;
  sha384?: ArrayBuffer | string;
  sha512?: ArrayBuffer | string;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  startAfter?: string;
  include?: ('httpMetadata' | 'customMetadata')[];
}

interface R2Range {
  offset: number;
  length?: number;
  suffix?: number;
}

interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}

// Cloudflare Queue Types
interface Queue<Body = unknown> {
  send(body: Body, options?: QueueSendOptions): Promise<void>;
  sendBatch(messages: QueueMessage<Body>[]): Promise<void>;
}

interface QueueMessage<Body = unknown> {
  id: string;
  timestamp: Date;
  body: Body;
  attempts: number;
  ack(): void;
  retry(options?: QueueRetryOptions): void;
}

interface QueueSendOptions {
  contentType?: string;
  delaySeconds?: number;
}

interface QueueRetryOptions {
  delaySeconds?: number;
}

interface MessageBatch<Body = unknown> {
  queue: string;
  messages: QueueMessage<Body>[];
  ackAll(): void;
  retryAll(options?: QueueRetryOptions): void;
}

// Cloudflare KV Types
interface KVNamespace {
  get(key: string, options?: KVGetOptions): Promise<string | null>;
  get(key: string, type: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<any>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
}

interface KVGetOptions {
  type?: 'text' | 'json' | 'arrayBuffer' | 'stream';
  cacheTtl?: number;
}

interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

interface KVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface KVListResult {
  keys: KVKey[];
  list_complete: boolean;
  cursor?: string;
}

interface KVKey {
  name: string;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

// QRCode module declaration
declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  export function toString(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: any, text: string, options?: any): Promise<any>;
  export function toFile(path: string, text: string, options?: any): Promise<void>;
}
