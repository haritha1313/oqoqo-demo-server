// Predetermined documentation gaps for demo
// These simulate what a real doc analyzer would find

export interface DocGap {
  id: string
  gap_type: 'STALENESS' | 'UNDOCUMENTED' | 'OBSOLETE'
  severity: 'critical' | 'high' | 'medium' | 'low'
  doc_file: string
  description: string
  evidence?: string
  suggested_fix: {
    file: string
    before: string
    after: string
  }
}

export const PREDETERMINED_GAPS: DocGap[] = [
  {
    id: 'gap_001',
    gap_type: 'STALENESS',
    severity: 'high',
    doc_file: 'docs/getting-started.md',
    description: 'Rate limit value differs between documentation and implementation',
    evidence: 'Documentation says 50 req/min but code defines RATE_LIMIT = 100',
    suggested_fix: {
      file: 'docs/getting-started.md',
      before: `## Rate Limiting

All endpoints are rate limited to **50 requests per minute** per API key. When exceeded, you'll receive a \`429 Too Many Requests\` response.

## Endpoints`,
      after: `## Rate Limiting

All endpoints are rate limited to **100 requests per minute** per API key. When exceeded, you'll receive a \`429 Too Many Requests\` response with a \`Retry-After\` header indicating when you can retry.

## Endpoints`
    }
  },
  {
    id: 'gap_002',
    gap_type: 'UNDOCUMENTED',
    severity: 'medium',
    doc_file: 'docs/architecture.md',
    description: 'WebSocket real-time updates feature is implemented but not documented',
    evidence: 'Found WebSocketServer in src/index.ts with event broadcasting',
    suggested_fix: {
      file: 'docs/architecture.md',
      before: `### Webhook Service (New)

The Webhook Service handles outbound event notifications:

- Event queuing and retry logic
- Signature verification
- Delivery status tracking

## Data Flow`,
      after: `### Webhook Service (New)

The Webhook Service handles outbound event notifications:

- Event queuing and retry logic
- Signature verification
- Delivery status tracking

### WebSocket Service

The WebSocket Service provides real-time updates to connected clients:

- Live event streaming for dashboard updates
- Connection management with automatic reconnection
- Event types: \`ANALYZING_CHANGES\`, \`COMMITTED\`, \`PR_CREATED\`, \`PR_MERGED\`

\`\`\`javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('wss://api.acme.io/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type);
};
\`\`\`

## Data Flow`
    }
  },
  {
    id: 'gap_003',
    gap_type: 'STALENESS',
    severity: 'low',
    doc_file: 'docs/how-to-guide.md',
    description: 'Error response format in documentation uses old string format instead of new object format',
    evidence: 'Code returns { error: { code, message } } but docs show { error: "string" }',
    suggested_fix: {
      file: 'docs/how-to-guide.md',
      before: `### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Invalid email format | Check the email address is valid |
| 401 | Unauthorized | Verify your API key is correct |
| 409 | Email already exists | Use a different email address |

## Fetching User Details`,
      after: `### Common Errors

| Status | Code | Message | Solution |
|--------|------|---------|----------|
| 400 | \`VALIDATION_ERROR\` | Invalid email format | Check the email address is valid |
| 401 | \`UNAUTHORIZED\` | Missing or invalid API key | Verify your API key is correct |
| 409 | \`CONFLICT\` | Email already exists | Use a different email address |

All errors follow a consistent JSON format:

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "field": "email"
  }
}
\`\`\`

## Fetching User Details`
    }
  },
  {
    id: 'gap_004',
    gap_type: 'UNDOCUMENTED',
    severity: 'high',
    doc_file: 'docs/getting-started.md',
    description: 'Batch operations endpoint is available but not documented',
    evidence: 'POST /users/batch endpoint found in routes/users.ts',
    suggested_fix: {
      file: 'docs/getting-started.md',
      before: `| DELETE | \`/users/:id\` | Delete a user |

#### Example: List Users`,
      after: `| DELETE | \`/users/:id\` | Delete a user |
| POST | \`/users/batch\` | Create multiple users |

#### Batch Operations

Create up to 100 users in a single request:

\`\`\`bash
curl -X POST https://api.acme.io/v1/users/batch \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "users": [
      { "email": "user1@example.com", "name": "User 1" },
      { "email": "user2@example.com", "name": "User 2" }
    ]
  }'
\`\`\`

#### Example: List Users`
    }
  },
  {
    id: 'gap_005',
    gap_type: 'OBSOLETE',
    severity: 'low',
    doc_file: 'docs/architecture.md',
    description: 'Documentation references deprecated v0 API endpoint format',
    evidence: 'Found reference to /api/v0/ which was removed in latest release',
    suggested_fix: {
      file: 'docs/architecture.md',
      before: `## API Versioning

The API uses URL-based versioning. The current version is \`v1\`.

\`\`\`
https://api.acme.io/v1/...
https://api.acme.io/v2/...  (coming soon)
\`\`\`

**Version Lifecycle:**
- \`v1\` - Current stable version
- \`v2\` - Beta (breaking changes)
- Deprecated versions receive 12 months support`,
      after: `## API Versioning

The API uses URL-based versioning. The current stable version is \`v1\`.

\`\`\`
https://api.acme.io/v1/...
\`\`\`

**Version Lifecycle:**
- \`v1\` - Current stable version (recommended)
- \`v2\` - In development, not yet available
- Deprecated versions are supported for 12 months after deprecation notice`
    }
  }
];

// Get the full updated content for a file with a specific gap fix applied
export function applyGapFix(gap: DocGap, currentContent: string): string {
  return currentContent.replace(gap.suggested_fix.before, gap.suggested_fix.after);
}
