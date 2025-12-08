import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Octokit } from '@octokit/rest';
import { INITIAL_DOCS, UPDATE_MAPPINGS, DEMO_CODE_AFTER, DEMO_CODE_BEFORE } from './mappings';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Environment
const PORT = process.env.PORT || 3001;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const DOCS_REPO_OWNER = process.env.DOCS_REPO_OWNER || 'haritha1313';
const DOCS_REPO = process.env.DOCS_REPO || 'oqoqo-demo-docs';
const PRODUCT_REPO_OWNER = process.env.PRODUCT_REPO_OWNER || 'haritha1313';
const PRODUCT_REPO = process.env.PRODUCT_REPO || 'oqoqo-demo-product';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'demo-secret';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

let accessLevel: 'high' | 'medium' = (process.env.AGENT_ACCESS_LEVEL as 'high' | 'medium') || 'medium';

// Auth middleware for protected routes
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!ADMIN_SECRET) {
    // If no admin secret configured, allow all (for development)
    return next();
  }
  if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// WebSocket clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected');
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

function broadcast(event: object) {
  const message = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
  console.log('Broadcast:', event);
}

// Pending reviews storage
interface Review {
  id: number;
  prNumber?: number;
  prUrl?: string;
  branch?: string;
  files: Record<string, { before: string; after: string }>;
  status: 'pending' | 'approved' | 'merged';
  createdAt: string;
}

const pendingReviews = new Map<number, Review>();
let reviewIdCounter = 1;

// Helper: Get file SHA from GitHub
async function getFileSha(owner: string, repo: string, path: string, ref = 'main'): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if ('sha' in data) return data.sha;
    return null;
  } catch {
    return null;
  }
}

// Helper: Commit file to repo
async function commitFile(owner: string, repo: string, path: string, content: string, message: string, branch = 'main') {
  const sha = await getFileSha(owner, repo, path, branch);
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    sha: sha || undefined,
    branch
  });
}

// HIGH ACCESS: Auto-commit directly to main
async function handleHighAccess(changedFiles: string[]) {
  broadcast({ type: 'ANALYZING_CHANGES', files: changedFiles });

  for (const file of changedFiles) {
    const updates = UPDATE_MAPPINGS[file];
    if (!updates) continue;

    for (const [docPath, newContent] of Object.entries(updates)) {
      broadcast({ type: 'COMMITTING', file: docPath });

      await commitFile(
        DOCS_REPO_OWNER,
        DOCS_REPO,
        docPath,
        newContent,
        `docs: auto-update ${docPath} based on code changes`
      );

      broadcast({ type: 'COMMITTED', file: docPath });
    }
  }

  broadcast({ type: 'DEPLOYMENT_STARTED' });
  // GitHub Pages will auto-deploy
}

// MEDIUM ACCESS: Create PR for review
async function handleMediumAccess(changedFiles: string[]) {
  broadcast({ type: 'ANALYZING_CHANGES', files: changedFiles });

  const updates: Record<string, { before: string; after: string }> = {};

  for (const file of changedFiles) {
    const fileUpdates = UPDATE_MAPPINGS[file];
    if (!fileUpdates) continue;

    for (const [docPath, newContent] of Object.entries(fileUpdates)) {
      updates[docPath] = {
        before: INITIAL_DOCS[docPath as keyof typeof INITIAL_DOCS] || '',
        after: newContent
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    broadcast({ type: 'NO_UPDATES_NEEDED' });
    return null;
  }

  const branchName = `docs-update-${Date.now()}`;

  // Get main branch SHA
  const { data: refData } = await octokit.git.getRef({
    owner: DOCS_REPO_OWNER,
    repo: DOCS_REPO,
    ref: 'heads/main'
  });

  // Create new branch
  await octokit.git.createRef({
    owner: DOCS_REPO_OWNER,
    repo: DOCS_REPO,
    ref: `refs/heads/${branchName}`,
    sha: refData.object.sha
  });

  broadcast({ type: 'BRANCH_CREATED', branch: branchName });

  // Commit each file to the branch
  for (const [docPath, { after }] of Object.entries(updates)) {
    await commitFile(
      DOCS_REPO_OWNER,
      DOCS_REPO,
      docPath,
      after,
      `docs: update ${docPath}`,
      branchName
    );
  }

  // Create PR
  const { data: pr } = await octokit.pulls.create({
    owner: DOCS_REPO_OWNER,
    repo: DOCS_REPO,
    title: 'docs: update documentation based on code changes',
    head: branchName,
    base: 'main',
    body: `## Automated Documentation Update

This PR was automatically generated based on code changes.

### Files Updated
${Object.keys(updates).map(f => `- \`${f}\``).join('\n')}

---
Generated by Oqoqo Demo`
  });

  broadcast({ type: 'PR_CREATED', prNumber: pr.number, prUrl: pr.html_url });

  // Store review
  const review: Review = {
    id: reviewIdCounter++,
    prNumber: pr.number,
    prUrl: pr.html_url,
    branch: branchName,
    files: updates,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  pendingReviews.set(review.id, review);

  return review;
}

// Routes

app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    accessLevel,
    pendingReviews: pendingReviews.size,
    docsRepo: `${DOCS_REPO_OWNER}/${DOCS_REPO}`,
    productRepo: `${PRODUCT_REPO_OWNER}/${PRODUCT_REPO}`
  });
});

app.get('/reviews', (req, res) => {
  const reviews = Array.from(pendingReviews.values()).filter(r => r.status === 'pending');
  res.json(reviews);
});

app.get('/reviews/:id', (req, res) => {
  const review = pendingReviews.get(parseInt(req.params.id));
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }
  res.json(review);
});

app.post('/reviews/:id/approve', requireAdmin, async (req, res) => {
  const review = pendingReviews.get(parseInt(req.params.id));
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  if (!review.prNumber) {
    return res.status(400).json({ error: 'No PR associated with this review' });
  }

  try {
    // Merge the PR
    await octokit.pulls.merge({
      owner: DOCS_REPO_OWNER,
      repo: DOCS_REPO,
      pull_number: review.prNumber,
      merge_method: 'squash'
    });

    broadcast({ type: 'PR_MERGED', prNumber: review.prNumber });

    // Delete branch
    try {
      await octokit.git.deleteRef({
        owner: DOCS_REPO_OWNER,
        repo: DOCS_REPO,
        ref: `heads/${review.branch}`
      });
    } catch (e) {
      // Branch might already be deleted
    }

    review.status = 'merged';
    broadcast({ type: 'DEPLOYMENT_STARTED' });

    res.json({ success: true, message: 'PR merged successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/reviews/:id/edit', requireAdmin, async (req, res) => {
  const review = pendingReviews.get(parseInt(req.params.id));
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  const { file, content } = req.body;
  if (!file || !content) {
    return res.status(400).json({ error: 'file and content required' });
  }

  if (!review.files[file]) {
    return res.status(400).json({ error: 'File not part of this review' });
  }

  try {
    // Commit the edit to the PR branch
    await commitFile(
      DOCS_REPO_OWNER,
      DOCS_REPO,
      file,
      content,
      `docs: manual edit to ${file}`,
      review.branch!
    );

    review.files[file].after = content;
    broadcast({ type: 'REVIEW_UPDATED', reviewId: review.id, file });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  broadcast({ type: 'WEBHOOK_RECEIVED', payload: req.body });

  const changedFiles = (req.body.changed_files || '').split(',').filter(Boolean);

  try {
    if (accessLevel === 'high') {
      await handleHighAccess(changedFiles);
    } else {
      await handleMediumAccess(changedFiles);
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/trigger', requireAdmin, async (req, res) => {
  broadcast({ type: 'DEMO_STARTED' });

  try {
    // Push code change to product repo
    await commitFile(
      PRODUCT_REPO_OWNER,
      PRODUCT_REPO,
      'src/routes/users.ts',
      DEMO_CODE_AFTER,
      'feat: add user update and delete endpoints, rate limiting'
    );

    broadcast({ type: 'CODE_PUSHED', file: 'src/routes/users.ts' });

    // Simulate webhook (since real webhook might take a moment)
    setTimeout(async () => {
      if (accessLevel === 'high') {
        await handleHighAccess(['src/routes/users.ts']);
      } else {
        await handleMediumAccess(['src/routes/users.ts']);
      }
    }, 1000);

    res.json({ triggered: true, accessLevel });
  } catch (error: any) {
    console.error('Trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/reset', requireAdmin, async (req, res) => {
  broadcast({ type: 'RESET_STARTED' });

  try {
    // Close all open PRs
    const { data: prs } = await octokit.pulls.list({
      owner: DOCS_REPO_OWNER,
      repo: DOCS_REPO,
      state: 'open'
    });

    for (const pr of prs) {
      await octokit.pulls.update({
        owner: DOCS_REPO_OWNER,
        repo: DOCS_REPO,
        pull_number: pr.number,
        state: 'closed'
      });
      broadcast({ type: 'PR_CLOSED', prNumber: pr.number });
    }

    // Reset docs to initial state
    for (const [path, content] of Object.entries(INITIAL_DOCS)) {
      await commitFile(DOCS_REPO_OWNER, DOCS_REPO, path, content, 'chore: reset to initial state');
    }

    // Reset product code
    await commitFile(
      PRODUCT_REPO_OWNER,
      PRODUCT_REPO,
      'src/routes/users.ts',
      DEMO_CODE_BEFORE,
      'chore: reset to initial state'
    );

    // Clear pending reviews
    pendingReviews.clear();
    reviewIdCounter = 1;

    broadcast({ type: 'DEMO_RESET' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/access-level', requireAdmin, (req, res) => {
  const { level } = req.body;
  if (level !== 'high' && level !== 'medium') {
    return res.status(400).json({ error: 'Invalid access level' });
  }
  accessLevel = level;
  broadcast({ type: 'ACCESS_LEVEL_CHANGED', level });
  res.json({ accessLevel });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access level: ${accessLevel}`);
  console.log(`Docs repo: ${DOCS_REPO_OWNER}/${DOCS_REPO}`);
  console.log(`Product repo: ${PRODUCT_REPO_OWNER}/${PRODUCT_REPO}`);
});
