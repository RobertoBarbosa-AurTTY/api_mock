/**
 * Mock API - In-memory data store
 *
 * Loads seed data from ./data at startup and keeps mutable collections in
 * memory for the lifetime of the process. Data is not persisted back to disk.
 */

export type ClientStatus = "ativo" | "inativo" | "pendente";

export interface Client {
  id: string;
  name: string;
  email: string;
  status: ClientStatus;
  registrationDate: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  password?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: string;
  tags?: Record<string, string>;
}

export type PaymentEvent =
  | "pagamento.pago"
  | "pagamento.falhou"
  | "pagamento.reembolsado";

export interface PaymentWebhook {
  event: PaymentEvent;
  data: {
    paymentId: string;
    orderId: string;
    amount: number;
    method: string;
    date: string;
  };
}

export interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface EmailRecord extends EmailPayload {
  id: string;
  status: "pendente" | "enviado" | "falha";
  attempts: number;
  createdAt: string;
}

interface PaymentWebhookRecord extends PaymentWebhook {
  receivedAt: string;
}

export const store = {
  clients: [] as Client[],
  users: [] as User[],
  products: [] as Product[],
  metrics: [] as Metric[],
  emails: [] as EmailRecord[],
  webhooks: [] as PaymentWebhookRecord[],
};

const DATA_DIR = new URL("./data/", import.meta.url);

async function readJson<T>(file: string): Promise<T> {
  const raw = await Deno.readTextFile(new URL(file, DATA_DIR));
  return JSON.parse(raw) as T;
}

/**
 * Loads all seed collections into memory.
 */
export async function loadStore(): Promise<void> {
  store.clients = await readJson<Client[]>("clients.json");
  store.users = await readJson<User[]>("users.json");
  store.products = await readJson<Product[]>("products.json");
  store.metrics = await readJson<Metric[]>("metrics.json");
}

let sequence = 0;

/**
 * Generates a sequential identifier.
 */
export function nextId(prefix = ""): string {
  sequence += 1;
  return `${prefix}${sequence}`;
}

/**
 * Registers a new metric, adding a timestamp.
 */
export function addMetric(metric: Omit<Metric, "timestamp">): Metric {
  const record: Metric = { ...metric, timestamp: new Date().toISOString() };
  store.metrics.push(record);
  return record;
}

/**
 * Simulates receiving an email for delivery.
 */
export function addEmail(payload: EmailPayload): EmailRecord {
  const record: EmailRecord = {
    ...payload,
    id: nextId("email_"),
    status: "enviado",
    attempts: 1,
    createdAt: new Date().toISOString(),
  };
  store.emails.push(record);
  return record;
}

/**
 * Stores a received payment webhook.
 */
export function addWebhook(webhook: PaymentWebhook): PaymentWebhookRecord {
  const record: PaymentWebhookRecord = {
    ...webhook,
    receivedAt: new Date().toISOString(),
  };
  store.webhooks.push(record);
  return record;
}

function nextNumericId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function addClient(input: Omit<Client, "id"> & { id?: string }): Client {
  const record: Client = { ...input, id: input.id ?? nextId("client_") };
  store.clients.push(record);
  return record;
}

export function findClient(id: string): Client | undefined {
  return store.clients.find((client) => client.id === id);
}

export function updateClient(
  id: string,
  patch: Partial<Omit<Client, "id">>,
): Client | undefined {
  const client = findClient(id);
  if (!client) return undefined;
  Object.assign(client, patch);
  return client;
}

export function removeClient(id: string): boolean {
  const index = store.clients.findIndex((client) => client.id === id);
  if (index === -1) return false;
  store.clients.splice(index, 1);
  return true;
}

export function addUser(input: Omit<User, "id"> & { id?: number }): User {
  const record: User = { ...input, id: input.id ?? nextNumericId(store.users) };
  store.users.push(record);
  return record;
}

export function findUser(id: number): User | undefined {
  return store.users.find((user) => user.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  return store.users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase(),
  );
}

export function updateUser(
  id: number,
  patch: Partial<Omit<User, "id">>,
): User | undefined {
  const user = findUser(id);
  if (!user) return undefined;
  Object.assign(user, patch);
  return user;
}

export function removeUser(id: number): boolean {
  const index = store.users.findIndex((user) => user.id === id);
  if (index === -1) return false;
  store.users.splice(index, 1);
  return true;
}

export function addProduct(
  input: Omit<Product, "id"> & { id?: number },
): Product {
  const record: Product = {
    ...input,
    id: input.id ?? nextNumericId(store.products),
  };
  store.products.push(record);
  return record;
}

export function findProduct(id: number): Product | undefined {
  return store.products.find((product) => product.id === id);
}

export function updateProduct(
  id: number,
  patch: Partial<Omit<Product, "id">>,
): Product | undefined {
  const product = findProduct(id);
  if (!product) return undefined;
  Object.assign(product, patch);
  return product;
}

export function removeProduct(id: number): boolean {
  const index = store.products.findIndex((product) => product.id === id);
  if (index === -1) return false;
  store.products.splice(index, 1);
  return true;
}
