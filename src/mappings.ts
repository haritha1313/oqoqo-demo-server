// Predetermined documentation updates - the "fake AI" part
// Maps code file changes to documentation updates

export const INITIAL_DOCS = {
  'docs/getting-started.md': `---
sidebar_position: 1
---

# Getting Started

Welcome to the Acme API! This guide will help you get up and running quickly.

## Base URL

All API requests should be made to:

\`\`\`
https://api.acme.io/v1
\`\`\`

## Authentication

Include your API key in the Authorization header:

\`\`\`bash
Authorization: Bearer YOUR_API_KEY
\`\`\`

You can obtain an API key from your [dashboard](https://dashboard.acme.io/api-keys).

## Endpoints

### Users

Manage user accounts in your application.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/users\` | List all users |
| POST | \`/users\` | Create a new user |
| GET | \`/users/:id\` | Get a user by ID |

#### Example: List Users

\`\`\`bash
curl -X GET https://api.acme.io/v1/users \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

Response:

\`\`\`json
{
  "data": [
    {
      "id": "usr_123",
      "email": "john@example.com",
      "name": "John Doe",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "has_more": false
}
\`\`\`

### Products

Manage your product catalog.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/products\` | List all products |
| POST | \`/products\` | Create a new product |
| GET | \`/products/:id\` | Get a product by ID |

#### Example: Create Product

\`\`\`bash
curl -X POST https://api.acme.io/v1/products \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Pro Plan",
    "price": 99.00,
    "currency": "USD"
  }'
\`\`\`

## Next Steps

- Read the [Architecture Overview](./architecture) to understand our system
- Follow the [How-To Guide](./how-to-guide) for step-by-step tutorials
`,

  'docs/architecture.md': `---
sidebar_position: 2
---

# Architecture Overview

The Acme platform is built on a modern microservices architecture designed for scalability and reliability.

## System Components

\`\`\`
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │     │   Auth      │     │   Data      │
│   Gateway   │────▶│   Service   │────▶│   Service   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │                                        ▼
      │                               ┌─────────────┐
      └──────────────────────────────▶│  PostgreSQL │
                                      └─────────────┘
\`\`\`

## Services

### API Gateway

The API Gateway is the entry point for all client requests. It handles:

- Request routing
- Authentication verification
- Request/response logging

### Auth Service

The Auth Service manages user authentication and authorization:

- API key validation
- Session management
- Permission checks

### Data Service

The Data Service handles all database operations:

- User CRUD operations
- Product management
- Data validation

## Data Flow

1. Client sends request to API Gateway
2. Gateway validates authentication with Auth Service
3. Valid requests are routed to Data Service
4. Data Service performs database operations
5. Response flows back through the Gateway

## Technology Stack

| Component | Technology |
|-----------|------------|
| API Gateway | Node.js / Express |
| Auth Service | Node.js / Express |
| Data Service | Node.js / Express |
| Database | PostgreSQL |
| Cache | Redis |

## Deployment

All services are deployed on AWS using:

- ECS for container orchestration
- RDS for managed PostgreSQL
- ElastiCache for Redis
`,

  'docs/how-to-guide.md': `---
sidebar_position: 3
---

# How-To Guide

Step-by-step tutorials for common tasks.

## Creating a User

This guide walks you through creating a new user via the API.

### Prerequisites

- An API key (get one from your [dashboard](https://dashboard.acme.io/api-keys))
- A tool for making HTTP requests (curl, Postman, etc.)

### Step 1: Prepare the Request

Create a JSON payload with the user details:

\`\`\`json
{
  "email": "newuser@example.com",
  "name": "Jane Smith"
}
\`\`\`

### Step 2: Send the Request

Make a POST request to the users endpoint:

\`\`\`bash
curl -X POST https://api.acme.io/v1/users \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "newuser@example.com",
    "name": "Jane Smith"
  }'
\`\`\`

### Step 3: Handle the Response

A successful request returns the created user:

\`\`\`json
{
  "id": "usr_456",
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "created_at": "2024-01-20T14:22:00Z"
}
\`\`\`

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Invalid email format | Check the email address is valid |
| 401 | Unauthorized | Verify your API key is correct |
| 409 | Email already exists | Use a different email address |

## Fetching User Details

To retrieve a specific user by ID:

\`\`\`bash
curl -X GET https://api.acme.io/v1/users/usr_456 \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

## Listing All Users

To list all users in your account:

\`\`\`bash
curl -X GET https://api.acme.io/v1/users \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

The response includes pagination info:

\`\`\`json
{
  "data": [...],
  "has_more": true,
  "next_cursor": "cur_abc123"
}
\`\`\`
`
};

// When users.ts is modified, this is the "after" content
export const UPDATE_MAPPINGS: Record<string, Record<string, string>> = {
  'src/routes/users.ts': {
    'docs/getting-started.md': `---
sidebar_position: 1
---

# Getting Started

Welcome to the Acme API! This guide will help you get up and running quickly.

## Base URL

All API requests should be made to:

\`\`\`
https://api.acme.io/v1
\`\`\`

## Authentication

Include your API key in the Authorization header:

\`\`\`bash
Authorization: Bearer YOUR_API_KEY
\`\`\`

You can obtain an API key from your [dashboard](https://dashboard.acme.io/api-keys).

## Rate Limiting

All endpoints are rate limited to **100 requests per minute** per API key. When exceeded, you'll receive a \`429 Too Many Requests\` response.

## Endpoints

### Users

Manage user accounts in your application.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/users\` | List all users (paginated) |
| POST | \`/users\` | Create a new user |
| GET | \`/users/:id\` | Get a user by ID |
| PATCH | \`/users/:id\` | Update a user |
| DELETE | \`/users/:id\` | Delete a user |

#### Example: List Users

\`\`\`bash
curl -X GET https://api.acme.io/v1/users \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

Response:

\`\`\`json
{
  "data": [
    {
      "id": "usr_123",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "admin",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "has_more": false,
  "total": 1
}
\`\`\`

#### Example: Update User

\`\`\`bash
curl -X PATCH https://api.acme.io/v1/users/usr_123 \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Updated",
    "role": "member"
  }'
\`\`\`

#### Example: Delete User

\`\`\`bash
curl -X DELETE https://api.acme.io/v1/users/usr_123 \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

### Products

Manage your product catalog.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/products\` | List all products |
| POST | \`/products\` | Create a new product |
| GET | \`/products/:id\` | Get a product by ID |

#### Example: Create Product

\`\`\`bash
curl -X POST https://api.acme.io/v1/products \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Pro Plan",
    "price": 99.00,
    "currency": "USD"
  }'
\`\`\`

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "field": "email"
  }
}
\`\`\`

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 404 | NOT_FOUND | Resource not found |
| 429 | RATE_LIMITED | Too many requests |

## Next Steps

- Read the [Architecture Overview](./architecture) to understand our system
- Follow the [How-To Guide](./how-to-guide) for step-by-step tutorials
`,

    'docs/how-to-guide.md': `---
sidebar_position: 3
---

# How-To Guide

Step-by-step tutorials for common tasks.

## Creating a User

This guide walks you through creating a new user via the API.

### Prerequisites

- An API key (get one from your [dashboard](https://dashboard.acme.io/api-keys))
- A tool for making HTTP requests (curl, Postman, etc.)

### Step 1: Prepare the Request

Create a JSON payload with the user details:

\`\`\`json
{
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "role": "member"
}
\`\`\`

**Available roles:** \`admin\`, \`member\`, \`viewer\`

### Step 2: Send the Request

Make a POST request to the users endpoint:

\`\`\`bash
curl -X POST https://api.acme.io/v1/users \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "member"
  }'
\`\`\`

### Step 3: Handle the Response

A successful request returns the created user:

\`\`\`json
{
  "id": "usr_456",
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "role": "member",
  "created_at": "2024-01-20T14:22:00Z",
  "updated_at": "2024-01-20T14:22:00Z"
}
\`\`\`

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Invalid email format | Check the email address is valid |
| 400 | Invalid role | Use one of: admin, member, viewer |
| 401 | Unauthorized | Verify your API key is correct |
| 409 | Email already exists | Use a different email address |
| 429 | Rate limited | Wait and retry after 60 seconds |

## Updating a User

To update an existing user:

\`\`\`bash
curl -X PATCH https://api.acme.io/v1/users/usr_456 \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Smith-Jones",
    "role": "admin"
  }'
\`\`\`

Only include the fields you want to update.

## Deleting a User

To delete a user:

\`\`\`bash
curl -X DELETE https://api.acme.io/v1/users/usr_456 \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

**Note:** This action is irreversible.

## Fetching User Details

To retrieve a specific user by ID:

\`\`\`bash
curl -X GET https://api.acme.io/v1/users/usr_456 \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

## Listing All Users

To list all users in your account:

\`\`\`bash
curl -X GET https://api.acme.io/v1/users \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

The response includes pagination info:

\`\`\`json
{
  "data": [...],
  "has_more": true,
  "total": 150,
  "next_cursor": "cur_abc123"
}
\`\`\`

Use the cursor for pagination:

\`\`\`bash
curl -X GET "https://api.acme.io/v1/users?cursor=cur_abc123" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`
`
  }
};

// Code file updates for triggering the demo
export const DEMO_CODE_BEFORE = `import { Router } from 'express';

const router = Router();

// In-memory storage for demo
const users: Array<{ id: string; email: string; name: string; created_at: string }> = [
  { id: 'usr_123', email: 'john@example.com', name: 'John Doe', created_at: '2024-01-15T10:30:00Z' }
];

// GET /users - List all users
router.get('/', (req, res) => {
  res.json({
    data: users,
    has_more: false
  });
});

// POST /users - Create a user
router.post('/', (req, res) => {
  const { email, name } = req.body;
  const newUser = {
    id: \`usr_\${Date.now()}\`,
    email,
    name,
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// GET /users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

export default router;
`;

export const DEMO_CODE_AFTER = `import { Router } from 'express';

const router = Router();

// In-memory storage for demo
const users: Array<{ id: string; email: string; name: string; role: string; created_at: string; updated_at: string }> = [
  { id: 'usr_123', email: 'john@example.com', name: 'John Doe', role: 'admin', created_at: '2024-01-15T10:30:00Z', updated_at: '2024-01-15T10:30:00Z' }
];

// Rate limiting (simple in-memory)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60000; // 1 minute

const checkRateLimit = (apiKey: string): boolean => {
  const now = Date.now();
  const record = requestCounts.get(apiKey);

  if (!record || now > record.resetAt) {
    requestCounts.set(apiKey, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
};

// GET /users - List all users (paginated)
router.get('/', (req, res) => {
  res.json({
    data: users,
    has_more: false,
    total: users.length
  });
});

// POST /users - Create a user
router.post('/', (req, res) => {
  const { email, name, role = 'member' } = req.body;
  const now = new Date().toISOString();
  const newUser = {
    id: \`usr_\${Date.now()}\`,
    email,
    name,
    role,
    created_at: now,
    updated_at: now
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// GET /users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }
  res.json(user);
});

// PATCH /users/:id - Update a user
router.patch('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  const { name, role } = req.body;
  if (name) user.name = name;
  if (role) user.role = role;
  user.updated_at = new Date().toISOString();

  res.json(user);
});

// DELETE /users/:id - Delete a user
router.delete('/:id', (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  users.splice(index, 1);
  res.status(204).send();
});

export default router;
`;
