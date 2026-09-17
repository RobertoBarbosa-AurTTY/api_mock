/**
 * Mock API - HTTP server
 *
 * Dependency-free Deno server that exposes in-memory seed data and simulated
 * endpoints used by the Pretreino backend challenges. It supports listing,
 * creating, updating and deleting records (clients, users, products, metrics),
 * simulated email delivery and incoming payment webhooks. It also serves the
 * OpenAPI spec and a Swagger UI page.
 *
 * Environment variables:
 * - PORT             HTTP port (default 8080, automatically set by Render)
 * - HOST             Bind address (default 0.0.0.0)
 * - WEBHOOK_SECRET   Expected X-Webhook-Signature (default "your_secret_here")
 * - TOKEN_TTL_HOURS  Logged-in session lifetime in hours (default 24)
 * - MOCK_FAILURE_RATE Probability (0..1) of returning a simulated 500 error
 * - MOCK_DELAY_MS    Artificial latency in milliseconds for /api/* requests
 */

import {
  addClient,
  addEmail,
  addMetric,
  addProduct,
  addUser,
  addWebhook,
  findClient,
  findProduct,
  findUser,
  findUserByEmail,
  loadStore,
  removeClient,
  removeProduct,
  removeUser,
  store,
  updateClient,
  updateProduct,
  updateUser,
} from "./store.ts";
import type {
  Client,
  ClientStatus,
  EmailPayload,
  PaymentWebhook,
  Product,
  User,
} from "./store.ts";
import { openApiSpec } from "./openapi.ts";

const PORT = Number(Deno.env.get("PORT") ?? "8080");
const HOST = Deno.env.get("HOST") ?? "0.0.0.0";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "your_secret_here";
const FAILURE_RATE = Number(Deno.env.get("MOCK_FAILURE_RATE") ?? "0");
const DELAY_MS = Number(Deno.env.get("MOCK_DELAY_MS") ?? "0");
const TOKEN_TTL_MS = Number(Deno.env.get("TOKEN_TTL_HOURS") ?? "24") * 60 * 60 *
  1000;
const STARTED_AT = new Date();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Webhook-Signature, X-Idempotency-Key",
  "Access-Control-Max-Age": "86400",
};

type Resource = "clients" | "users" | "products" | "metrics";

const RESOURCE_ALIASES: Record<string, Resource> = {
  clientes: "clients",
  clients: "clients",
  usuarios: "users",
  users: "users",
  produtos: "products",
  products: "products",
  metricas: "metrics",
  metrics: "metrics",
};

interface ApiRoute {
  kind: "emails" | "webhooks" | "resource";
  resource?: Resource;
  id?: string;
}

const API_ROUTES = [
  "POST   /api/auth/login",
  "GET    /api/auth/me",
  "POST   /api/auth/logout",
  "GET    /api/clientes",
  "GET    /api/clientes/:id",
  "POST   /api/clientes",
  "PUT    /api/clientes/:id",
  "PATCH  /api/clientes/:id",
  "DELETE /api/clientes/:id",
  "GET    /api/usuarios",
  "GET    /api/usuarios/:id",
  "POST   /api/usuarios",
  "PUT    /api/usuarios/:id",
  "PATCH  /api/usuarios/:id",
  "DELETE /api/usuarios/:id",
  "GET    /api/produtos",
  "GET    /api/produtos/:id",
  "POST   /api/produtos",
  "PUT    /api/produtos/:id",
  "PATCH  /api/produtos/:id",
  "DELETE /api/produtos/:id",
  "GET    /api/metricas",
  "POST   /api/metricas",
  "POST   /api/emails",
  "POST   /api/webhooks",
];

interface Session {
  userId: number;
  issuedAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function publicUser(user: User): Omit<User, "password"> {
  const { password: _password, ...rest } = user;
  return rest;
}

function sessionUser(req: Request): Session | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function sessionToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function fail(message: string, status = 400, details?: unknown): Response {
  return json({ error: true, message, details }, status);
}

async function readBody<T>(req: Request): Promise<T | null> {
  try {
    const raw = await req.text();
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseId(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function pick<T extends object>(
  source: Record<string, unknown>,
  keys: (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    const value = source[key as string];
    if (value !== undefined) {
      (result as Record<string, unknown>)[key as string] = value;
    }
  }
  return result;
}

/**
 * Applies the optional latency/failure simulation. Returns a 500 response when
 * a failure is triggered, or null when the request should proceed.
 */
async function simulate(url: URL): Promise<Response | null> {
  const delay = Number(url.searchParams.get("delay") ?? "0") || DELAY_MS;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const forced = url.searchParams.get("fail") === "true";
  const random = FAILURE_RATE > 0 && Math.random() < FAILURE_RATE;
  if (forced || random) {
    return fail("Simulated failure", 500);
  }
  return null;
}

function resolveApi(pathname: string): ApiRoute | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments.length > 3) return null;
  const [, name, id] = segments;

  if (segments.length === 2 && name === "emails") return { kind: "emails" };
  if (segments.length === 2 && name === "webhooks") return { kind: "webhooks" };
  if (segments.length === 3 && name === "pagamentos" && id === "webhook") {
    return { kind: "webhooks" };
  }

  const resource = RESOURCE_ALIASES[name];
  if (!resource) return null;
  return { kind: "resource", resource, id };
}

function listResource(resource: Resource, url: URL): Response {
  switch (resource) {
    case "clients": {
      const status = url.searchParams.get("status");
      const data = status
        ? store.clients.filter((client) => client.status === status)
        : store.clients;
      return json(data);
    }
    case "users":
      return json(store.users.map(publicUser));
    case "products":
      return json(store.products);
    case "metrics": {
      const name = url.searchParams.get("name");
      const data = name
        ? store.metrics.filter((metric) => metric.name === name)
        : store.metrics;
      return json(data);
    }
  }
}

async function createResource(
  resource: Resource,
  req: Request,
): Promise<Response> {
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail("Invalid JSON payload", 422);

  switch (resource) {
    case "clients": {
      const name = str(body.name);
      const email = str(body.email);
      if (!name || !email) return fail("name and email are required", 422);
      const status = (str(body.status) as ClientStatus | undefined) ?? "ativo";
      const registrationDate = str(body.registrationDate) ??
        new Date().toISOString().slice(0, 10);
      return json(addClient({ name, email, status, registrationDate }), 201);
    }
    case "users": {
      const name = str(body.name);
      const email = str(body.email);
      if (!name || !email) return fail("name and email are required", 422);
      const role = str(body.role) ?? "user";
      const password = str(body.password);
      return json(
        publicUser(addUser({ name, email, role, password })),
        201,
      );
    }
    case "products": {
      const name = str(body.name);
      const price = num(body.price);
      if (!name || price === undefined) {
        return fail("name and price are required", 422);
      }
      const stock = num(body.stock) ?? 0;
      return json(addProduct({ name, price, stock }), 201);
    }
    case "metrics": {
      const name = str(body.name);
      const value = num(body.value);
      if (!name || value === undefined) {
        return fail("name and value are required", 422);
      }
      const tags = body.tags && typeof body.tags === "object"
        ? (body.tags as Record<string, string>)
        : undefined;
      return json(addMetric({ name, value, tags }), 201);
    }
  }
}

function getOne(resource: Resource, id: string): Response {
  switch (resource) {
    case "clients": {
      const client = findClient(id);
      return client ? json(client) : fail("Client not found", 404);
    }
    case "users": {
      const numeric = parseId(id);
      const user = numeric === null ? undefined : findUser(numeric);
      return user ? json(publicUser(user)) : fail("User not found", 404);
    }
    case "products": {
      const numeric = parseId(id);
      const product = numeric === null ? undefined : findProduct(numeric);
      return product ? json(product) : fail("Product not found", 404);
    }
    case "metrics":
      return fail("Method not allowed", 405);
  }
}

async function updateResource(
  resource: Resource,
  id: string,
  req: Request,
): Promise<Response> {
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail("Invalid JSON payload", 422);

  switch (resource) {
    case "clients": {
      const patch = pick<Omit<Client, "id">>(body, [
        "name",
        "email",
        "status",
        "registrationDate",
      ]);
      const updated = updateClient(id, patch);
      return updated ? json(updated) : fail("Client not found", 404);
    }
    case "users": {
      const numeric = parseId(id);
      if (numeric === null) return fail("Invalid id", 400);
      const patch = pick<Omit<User, "id">>(body, [
        "name",
        "email",
        "role",
        "password",
      ]);
      const updated = updateUser(numeric, patch);
      return updated ? json(publicUser(updated)) : fail("User not found", 404);
    }
    case "products": {
      const numeric = parseId(id);
      if (numeric === null) return fail("Invalid id", 400);
      const patch = pick<Omit<Product, "id">>(body, ["name", "price", "stock"]);
      const updated = updateProduct(numeric, patch);
      return updated ? json(updated) : fail("Product not found", 404);
    }
    case "metrics":
      return fail("Method not allowed", 405);
  }
}

function removeResource(resource: Resource, id: string): Response {
  switch (resource) {
    case "clients":
      return removeClient(id) ? noContent() : fail("Client not found", 404);
    case "users": {
      const numeric = parseId(id);
      if (numeric === null) return fail("Invalid id", 400);
      return removeUser(numeric) ? noContent() : fail("User not found", 404);
    }
    case "products": {
      const numeric = parseId(id);
      if (numeric === null) return fail("Invalid id", 400);
      return removeProduct(numeric)
        ? noContent()
        : fail("Product not found", 404);
    }
    case "metrics":
      return fail("Method not allowed", 405);
  }
}

async function handleApi(
  req: Request,
  method: string,
  url: URL,
  route: ApiRoute,
): Promise<Response> {
  if (route.kind === "emails") {
    if (method !== "POST") return fail("Method not allowed", 405);
    const body = await readBody<EmailPayload>(req);
    if (
      !body || typeof body.to !== "string" || typeof body.subject !== "string"
    ) {
      return fail("Invalid email payload", 422);
    }
    const record = addEmail(body);
    return json({ success: true, emailId: record.id }, 201);
  }

  if (route.kind === "webhooks") {
    if (method !== "POST") return fail("Method not allowed", 405);
    const signature = req.headers.get("X-Webhook-Signature");
    if (signature !== WEBHOOK_SECRET) {
      return fail("Invalid webhook signature", 401);
    }
    const body = await readBody<PaymentWebhook>(req);
    if (!body || typeof body.event !== "string" || !body.data) {
      return fail("Invalid webhook payload", 422);
    }
    const record = addWebhook(body);
    return json(
      {
        success: true,
        message: "Webhook received",
        paymentId: record.data.paymentId,
      },
      201,
    );
  }

  const resource = route.resource as Resource;
  const id = route.id;

  if (!id) {
    if (method === "GET") return listResource(resource, url);
    if (method === "POST") return await createResource(resource, req);
    return fail("Method not allowed", 405);
  }

  if (method === "GET") return getOne(resource, id);
  if (method === "PUT" || method === "PATCH") {
    return await updateResource(resource, id, req);
  }
  if (method === "DELETE") return removeResource(resource, id);
  return fail("Method not allowed", 405);
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (method === "GET" && (pathname === "/docs" || pathname === "/swagger")) {
    return html(swaggerPage());
  }

  if (method === "GET" && pathname === "/openapi.json") {
    return json(openApiSpec);
  }

  if (method === "GET" && pathname === "/health") {
    return json({
      status: "ok",
      uptimeSeconds: Number(
        ((Date.now() - STARTED_AT.getTime()) / 1000).toFixed(1),
      ),
      startedAt: STARTED_AT.toISOString(),
      timestamp: new Date().toISOString(),
    });
  }

  if (method === "GET" && pathname === "/") {
    return json({
      name: "Pretreino Mock API",
      version: "1.0.0",
      docs: "/docs",
      openapi: "/openapi.json",
      endpoints: API_ROUTES,
    });
  }

  if (pathname === "/api/auth/login") {
    if (method !== "POST") return fail("Method not allowed", 405);
    const body = await readBody<{ email?: string; password?: string }>(req);
    const email = str(body?.email);
    const password = str(body?.password);
    if (!email || !password) {
      return fail("email and password are required", 422);
    }
    const user = findUserByEmail(email);
    if (!user || !user.password || user.password !== password) {
      return fail("Invalid credentials", 401);
    }
    const token = generateToken();
    const now = Date.now();
    sessions.set(token, {
      userId: user.id,
      issuedAt: now,
      expiresAt: now + TOKEN_TTL_MS,
    });
    return json({
      token,
      tokenType: "Bearer",
      expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
      user: publicUser(user),
    });
  }

  if (pathname === "/api/auth/me") {
    if (method !== "GET") return fail("Method not allowed", 405);
    const session = sessionUser(req);
    if (!session) return fail("Unauthorized", 401);
    const user = findUser(session.userId);
    if (!user) return fail("User not found", 404);
    return json({
      ...publicUser(user),
      loginAt: new Date(session.issuedAt).toISOString(),
    });
  }

  if (pathname === "/api/auth/logout") {
    if (method !== "POST") return fail("Method not allowed", 405);
    const token = sessionToken(req);
    if (!token || !sessions.has(token)) return fail("Unauthorized", 401);
    sessions.delete(token);
    return json({ success: true });
  }

  if (pathname.startsWith("/api/")) {
    const session = sessionUser(req);
    if (!session) return fail("Unauthorized", 401);
    const apiRoute = resolveApi(pathname);
    if (!apiRoute) return fail("Route not found", 404);
    const simulated = await simulate(url);
    if (simulated) return simulated;
    return await handleApi(req, method, url, apiRoute);
  }

  return fail("Route not found", 404);
}

async function handle(req: Request): Promise<Response> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await route(req);
  } catch (error) {
    console.error("Unhandled error:", error);
    response = fail("Internal server error", 500);
  }
  const elapsed = (performance.now() - startedAt).toFixed(1);
  console.log(
    `${req.method} ${
      new URL(req.url).pathname
    } -> ${response.status} (${elapsed}ms)`,
  );
  return response;
}

function swaggerPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pretreino Mock API - Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>body { margin: 0; background: #fafafa; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          displayOperationId: false,
          presets: [SwaggerUIBundle.presets.apis],
        });
      };
    </script>
  </body>
</html>`;
}

await loadStore();

Deno.serve(
  {
    port: PORT,
    hostname: HOST,
    onListen: ({ hostname, port }) => {
      console.log(`Pretreino Mock API listening on http://${hostname}:${port}`);
      console.log(`Swagger UI: http://localhost:${port}/docs`);
    },
  },
  handle,
);
