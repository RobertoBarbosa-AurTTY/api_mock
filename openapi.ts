/**
 * Mock API - OpenAPI 3.0.3 specification
 *
 * Served at /openapi.json and consumed by the Swagger UI at /docs.
 */

const jsonResponse = (schema: unknown, description: string) => ({
  description,
  content: {
    "application/json": { schema },
  },
});

const errorResponse = (description: string) =>
  jsonResponse({ $ref: "#/components/schemas/Error" }, description);

const clientRef = { $ref: "#/components/schemas/Client" };
const userRef = { $ref: "#/components/schemas/User" };
const productRef = { $ref: "#/components/schemas/Product" };
const metricRef = { $ref: "#/components/schemas/Metric" };

const listResponse = (item: unknown, description: string) =>
  jsonResponse({ type: "array", items: item }, description);

const jsonBody = (schema: unknown, required = true) => ({
  required,
  content: { "application/json": { schema } },
});

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Record identifier",
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Pretreino Mock API",
    version: "1.0.0",
    description: "Mock API used by the Pretreino backend challenges. " +
      "Provides seed data for customers, users, products, metrics, " +
      "simulated email delivery and incoming payment webhooks. " +
      "Deployed as a container and reachable at http://localhost:8080 locally.",
  },
  servers: [
    { url: "/", description: "Current server" },
    { url: "http://localhost:8080", description: "Local development" },
  ],
  tags: [
    { name: "Health", description: "Service status" },
    { name: "Customers", description: "Challenge 01 - Customers API" },
    { name: "Users", description: "Challenge 08 - External API cache" },
    { name: "Products", description: "Challenge 08 - External API cache" },
    { name: "Metrics", description: "Challenge 10 - Metrics dashboard" },
    { name: "Emails", description: "Challenge 03 - Email notification" },
    { name: "Webhooks", description: "Challenge 06 - Payment webhook" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        operationId: "getHealth",
        responses: {
          "200": jsonResponse(
            { $ref: "#/components/schemas/Health" },
            "Service is healthy",
          ),
        },
      },
    },
    "/api/clientes": {
      get: {
        tags: ["Customers"],
        summary: "List customers",
        description:
          "Returns the customer list. Also available at `/api/clients`. " +
          "The `status` values are `ativo`, `inativo` or `pendente`.",
        operationId: "listClients",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["ativo", "inativo", "pendente"] },
            description: "Filters customers by status",
          },
        ],
        responses: {
          "200": listResponse(clientRef, "Customer list"),
          "500": errorResponse("Simulated failure"),
        },
      },
      post: {
        tags: ["Customers"],
        summary: "Create a customer",
        description: "Stores a new customer in memory and returns it.",
        operationId: "createClient",
        requestBody: jsonBody({ $ref: "#/components/schemas/ClientInput" }),
        responses: {
          "201": jsonResponse(clientRef, "Customer created"),
          "422": errorResponse("Invalid payload"),
          "500": errorResponse("Simulated failure"),
        },
      },
    },
    "/api/clientes/{id}": {
      parameters: [idParam],
      get: {
        tags: ["Customers"],
        summary: "Get a customer by id",
        operationId: "getClient",
        responses: {
          "200": jsonResponse(clientRef, "Customer found"),
          "404": errorResponse("Customer not found"),
        },
      },
      put: {
        tags: ["Customers"],
        summary: "Update a customer",
        description: "Replaces the provided fields of the customer.",
        operationId: "updateClient",
        requestBody: jsonBody(
          { $ref: "#/components/schemas/ClientInput" },
          false,
        ),
        responses: {
          "200": jsonResponse(clientRef, "Customer updated"),
          "404": errorResponse("Customer not found"),
          "422": errorResponse("Invalid payload"),
        },
      },
      patch: {
        tags: ["Customers"],
        summary: "Partially update a customer",
        operationId: "patchClient",
        requestBody: jsonBody(
          { $ref: "#/components/schemas/ClientInput" },
          false,
        ),
        responses: {
          "200": jsonResponse(clientRef, "Customer updated"),
          "404": errorResponse("Customer not found"),
          "422": errorResponse("Invalid payload"),
        },
      },
      delete: {
        tags: ["Customers"],
        summary: "Delete a customer",
        operationId: "deleteClient",
        responses: {
          "204": { description: "Customer deleted" },
          "404": errorResponse("Customer not found"),
        },
      },
    },
    "/api/usuarios": {
      get: {
        tags: ["Users"],
        summary: "List users",
        description:
          "Returns the external API user list. Also available at `/api/users`.",
        operationId: "listUsers",
        responses: {
          "200": listResponse(userRef, "User list"),
          "500": errorResponse("Simulated failure"),
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create a user",
        description: "Stores a new user in memory and returns it.",
        operationId: "createUser",
        requestBody: jsonBody({ $ref: "#/components/schemas/UserInput" }),
        responses: {
          "201": jsonResponse(userRef, "User created"),
          "422": errorResponse("Invalid payload"),
          "500": errorResponse("Simulated failure"),
        },
      },
    },
    "/api/usuarios/{id}": {
      parameters: [idParam],
      get: {
        tags: ["Users"],
        summary: "Get a user by id",
        operationId: "getUser",
        responses: {
          "200": jsonResponse(userRef, "User found"),
          "404": errorResponse("User not found"),
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update a user",
        operationId: "updateUser",
        requestBody: jsonBody(
          { $ref: "#/components/schemas/UserInput" },
          false,
        ),
        responses: {
          "200": jsonResponse(userRef, "User updated"),
          "404": errorResponse("User not found"),
          "422": errorResponse("Invalid payload"),
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Partially update a user",
        operationId: "patchUser",
        requestBody: jsonBody(
          { $ref: "#/components/schemas/UserInput" },
          false,
        ),
        responses: {
          "200": jsonResponse(userRef, "User updated"),
          "404": errorResponse("User not found"),
          "422": errorResponse("Invalid payload"),
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete a user",
        operationId: "deleteUser",
        responses: {
          "204": { description: "User deleted" },
          "404": errorResponse("User not found"),
        },
      },
    },
    "/api/produtos": {
      get: {
        tags: ["Products"],
        summary: "List products",
        description:
          "Returns the external API product list. Also available at `/api/products`.",
        operationId: "listProducts",
        responses: {
          "200": listResponse(productRef, "Product list"),
          "500": errorResponse("Simulated failure"),
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create a product",
        description: "Stores a new product in memory and returns it.",
        operationId: "createProduct",
        requestBody: jsonBody({ $ref: "#/components/schemas/ProductInput" }),
        responses: {
          "201": jsonResponse(productRef, "Product created"),
          "422": errorResponse("Invalid payload"),
          "500": errorResponse("Simulated failure"),
        },
      },
    },
    "/api/produtos/{id}": {
      parameters: [idParam],
      get: {
        tags: ["Products"],
        summary: "Get a product by id",
        operationId: "getProduct",
        responses: {
          "200": jsonResponse(productRef, "Product found"),
          "404": errorResponse("Product not found"),
        },
      },
      put: {
        tags: ["Products"],
        summary: "Update a product",
        operationId: "updateProduct",
        requestBody: jsonBody(
          { $ref: "#/components/schemas/ProductInput" },
          false,
        ),
        responses: {
          "200": jsonResponse(productRef, "Product updated"),
          "404": errorResponse("Product not found"),
          "422": errorResponse("Invalid payload"),
        },
      },
      patch: {
        tags: ["Products"],
        summary: "Partially update a product",
        operationId: "patchProduct",
        requestBody: jsonBody(
          { $ref: "#/components/schemas/ProductInput" },
          false,
        ),
        responses: {
          "200": jsonResponse(productRef, "Product updated"),
          "404": errorResponse("Product not found"),
          "422": errorResponse("Invalid payload"),
        },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete a product",
        operationId: "deleteProduct",
        responses: {
          "204": { description: "Product deleted" },
          "404": errorResponse("Product not found"),
        },
      },
    },
    "/api/metricas": {
      get: {
        tags: ["Metrics"],
        summary: "List metrics",
        description:
          "Returns stored metrics. Also available at `/api/metrics`.",
        operationId: "listMetrics",
        parameters: [
          {
            name: "name",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filters metrics by name",
          },
        ],
        responses: {
          "200": listResponse(metricRef, "Metric list"),
          "500": errorResponse("Simulated failure"),
        },
      },
      post: {
        tags: ["Metrics"],
        summary: "Register a metric",
        description:
          "Stores a new metric and returns it with a generated timestamp. Also available at `POST /api/metrics`.",
        operationId: "createMetric",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MetricInput" },
            },
          },
        },
        responses: {
          "201": jsonResponse(metricRef, "Metric registered"),
          "422": errorResponse("Invalid payload"),
          "500": errorResponse("Simulated failure"),
        },
      },
    },
    "/api/emails": {
      post: {
        tags: ["Emails"],
        summary: "Simulate email delivery",
        description:
          "Accepts an email and simulates sending it. Returns a generated email id. " +
          "Use `?fail=true` to force a failure and exercise retry logic.",
        operationId: "sendEmail",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EmailInput" },
            },
          },
        },
        responses: {
          "201": jsonResponse(
            { $ref: "#/components/schemas/EmailResult" },
            "Email accepted",
          ),
          "422": errorResponse("Invalid payload"),
          "500": errorResponse("Simulated failure"),
        },
      },
    },
    "/api/webhooks": {
      post: {
        tags: ["Webhooks"],
        summary: "Receive a payment webhook",
        description:
          "Receives and stores a payment webhook. Also available at `/api/pagamentos/webhook`. " +
          "The `X-Webhook-Signature` header must match the server `WEBHOOK_SECRET`.",
        operationId: "receiveWebhook",
        parameters: [
          {
            name: "X-Webhook-Signature",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Must match the WEBHOOK_SECRET environment variable",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PaymentWebhook" },
            },
          },
        },
        responses: {
          "201": jsonResponse(
            { $ref: "#/components/schemas/WebhookResult" },
            "Webhook received",
          ),
          "401": errorResponse("Invalid webhook signature"),
          "422": errorResponse("Invalid payload"),
        },
      },
    },
  },
  components: {
    schemas: {
      Client: {
        type: "object",
        required: ["id", "name", "email", "status", "registrationDate"],
        properties: {
          id: { type: "string", example: "1" },
          name: { type: "string", example: "João Silva" },
          email: {
            type: "string",
            format: "email",
            example: "joao.silva@email.com",
          },
          status: {
            type: "string",
            enum: ["ativo", "inativo", "pendente"],
            example: "ativo",
          },
          registrationDate: { type: "string", example: "2024-01-15" },
        },
      },
      ClientInput: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", example: "João Silva" },
          email: {
            type: "string",
            format: "email",
            example: "joao.silva@email.com",
          },
          status: {
            type: "string",
            enum: ["ativo", "inativo", "pendente"],
            example: "ativo",
          },
          registrationDate: {
            type: "string",
            example: "2024-01-15",
            description: "Defaults to the current date when omitted",
          },
        },
      },
      User: {
        type: "object",
        required: ["id", "name", "email", "role"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "João Silva" },
          email: { type: "string", format: "email", example: "joao@email.com" },
          role: { type: "string", example: "Desenvolvedor" },
        },
      },
      UserInput: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", example: "João Silva" },
          email: { type: "string", format: "email", example: "joao@email.com" },
          role: {
            type: "string",
            example: "Desenvolvedor",
            description: 'Defaults to "user" when omitted',
          },
        },
      },
      Product: {
        type: "object",
        required: ["id", "name", "price", "stock"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Notebook" },
          price: { type: "number", format: "float", example: 4500.0 },
          stock: { type: "integer", example: 10 },
        },
      },
      ProductInput: {
        type: "object",
        required: ["name", "price"],
        properties: {
          name: { type: "string", example: "Notebook" },
          price: { type: "number", format: "float", example: 4500.0 },
          stock: {
            type: "integer",
            example: 10,
            description: "Defaults to 0 when omitted",
          },
        },
      },
      Metric: {
        type: "object",
        required: ["name", "value", "timestamp"],
        properties: {
          name: { type: "string", example: "response_time" },
          value: { type: "number", example: 120 },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-01-20T10:00:00Z",
          },
          tags: {
            type: "object",
            additionalProperties: { type: "string" },
            example: { route: "/api/users", method: "GET" },
          },
        },
      },
      MetricInput: {
        type: "object",
        required: ["name", "value"],
        properties: {
          name: { type: "string", example: "response_time" },
          value: { type: "number", example: 120 },
          tags: {
            type: "object",
            additionalProperties: { type: "string" },
            example: { route: "/api/users", method: "GET" },
          },
        },
      },
      EmailInput: {
        type: "object",
        required: ["to", "subject", "template", "data"],
        properties: {
          to: {
            type: "string",
            format: "email",
            example: "cliente1@email.com",
          },
          subject: { type: "string", example: "Confirmação de Pedido #123" },
          template: { type: "string", example: "confirmacao" },
          data: {
            type: "object",
            additionalProperties: true,
            example: { name: "João Silva", order: "123" },
          },
        },
      },
      EmailResult: {
        type: "object",
        required: ["success", "emailId"],
        properties: {
          success: { type: "boolean", example: true },
          emailId: { type: "string", example: "email_1" },
        },
      },
      PaymentWebhook: {
        type: "object",
        required: ["event", "data"],
        properties: {
          event: {
            type: "string",
            enum: [
              "pagamento.pago",
              "pagamento.falhou",
              "pagamento.reembolsado",
            ],
            example: "pagamento.pago",
          },
          data: {
            type: "object",
            required: ["paymentId", "orderId", "amount", "method", "date"],
            properties: {
              paymentId: { type: "string", example: "pag_123456" },
              orderId: { type: "string", example: "ped_789012" },
              amount: { type: "number", format: "float", example: 1500.0 },
              method: { type: "string", example: "credit_card" },
              date: {
                type: "string",
                format: "date-time",
                example: "2024-01-20T10:30:00Z",
              },
            },
          },
        },
      },
      WebhookResult: {
        type: "object",
        required: ["success", "message", "paymentId"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Webhook received" },
          paymentId: { type: "string", example: "pag_123456" },
        },
      },
      Health: {
        type: "object",
        required: ["status", "uptimeSeconds", "startedAt", "timestamp"],
        properties: {
          status: { type: "string", example: "ok" },
          uptimeSeconds: { type: "number", example: 42.5 },
          startedAt: { type: "string", format: "date-time" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "boolean", example: true },
          message: { type: "string", example: "Invalid payload" },
          details: { nullable: true },
        },
      },
    },
  },
} as const;
