/**
 * Cloudflare Worker Entry Point
 * Handles both HTTP requests and Queue messages
 */

import { handleQueue, CertificateJob } from '../src/workers/queueConsumer';

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  CERTIFICATE_QUEUE: Queue<CertificateJob>;
  CACHE_KV: KVNamespace;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_ALLOWED_HD?: string;
}

export default {
  /**
   * Handle Queue messages
   */
  async queue(batch: MessageBatch<CertificateJob>, env: Env): Promise<void> {
    await handleQueue(batch, env);
  },

  /**
   * Handle HTTP requests (delegated to Pages Functions)
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // This will be handled by Pages Functions in functions/api/[[path]].ts
    return new Response('Not Found', { status: 404 });
  },
};
