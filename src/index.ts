import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Octokit } from '@octokit/rest';
import { INITIAL_DOCS, UPDATE_MAPPINGS, DEMO_CODE_AFTER, DEMO_CODE_BEFORE } from './mappings';
import { PREDETERMINED_GAPS, DocGap } from './gaps';

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

// ============================================
// DOC ANALYSIS ENDPOINTS
// ============================================

// Helper: Send SSE event
function sendSSE(res: express.Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// GET /analyze/stream - Run documentation gap analysis with SSE streaming
app.get('/analyze/stream', requireAdmin, async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  broadcast({ type: 'ANALYSIS_STARTED' });

  const totalSteps = 4;
  let currentStep = 0;
  let subProgress = 0; // Track progress within each step

  // Custom percentage mapping - step 3 takes longer visually
  const getPercent = (step: number, sub: number = 0) => {
    // Step 1: 0-15%, Step 2: 15-35%, Step 3: 35-60%, Step 4: 60-100%
    const stepRanges: Record<number, [number, number]> = {
      1: [0, 15],
      2: [15, 35],
      3: [35, 60],
      4: [60, 100]
    };
    const [start, end] = stepRanges[step] || [0, 100];
    return Math.round(start + (end - start) * sub);
  };

  // Helper to send progress updates
  const sendProgress = (step: number, stepName: string, detail: string, sub: number = 0.5) => {
    sendSSE(res, 'progress', {
      step,
      totalSteps,
      stepName,
      detail,
      percent: getPercent(step, sub)
    });
  };

  try {
    // ==========================================
    // Phase 1: Profiling documentation (faster - simple file scanning)
    // ==========================================
    currentStep = 1;
    sendProgress(currentStep, 'Profiling documentation', 'Scanning doc files...', 0);
    sendSSE(res, 'log', { message: 'Phase 1: Profiling documentation...' });
    await new Promise(r => setTimeout(r, 300));

    const docFiles = ['docs/getting-started.md', 'docs/architecture.md', 'docs/how-to-guide.md'];
    for (let i = 0; i < docFiles.length; i++) {
      const file = docFiles[i];
      sendSSE(res, 'log', { message: `  Scanning ${file}` });
      sendProgress(currentStep, 'Profiling documentation', `Scanning ${file}`, (i + 1) / docFiles.length * 0.6);
      await new Promise(r => setTimeout(r, 200));
    }

    sendSSE(res, 'log', { message: `  Found ${docFiles.length} doc files` });
    await new Promise(r => setTimeout(r, 150));

    // Extract features from docs
    sendProgress(currentStep, 'Profiling documentation', 'Extracting features from docs...', 0.8);
    sendSSE(res, 'log', { message: '  Extracting features from documentation...' });
    await new Promise(r => setTimeout(r, 400));

    const docFeatures = ['API endpoints', 'Rate limiting', 'Authentication', 'Error handling', 'User management'];
    sendSSE(res, 'log', { message: `  Extracted ${docFeatures.length} documented features` });
    sendProgress(currentStep, 'Profiling documentation', 'Done', 1);
    await new Promise(r => setTimeout(r, 200));

    // ==========================================
    // Phase 2: Building code inventory (medium - parsing code)
    // ==========================================
    currentStep = 2;
    sendProgress(currentStep, 'Building code inventory', 'Scanning source files...', 0);
    sendSSE(res, 'log', { message: '\nPhase 2: Building code inventory...' });
    await new Promise(r => setTimeout(r, 350));

    const codeFiles = [
      'src/routes/users.ts',
      'src/routes/products.ts',
      'src/routes/orders.ts',
      'src/middleware/auth.ts',
      'src/middleware/rateLimit.ts',
      'src/index.ts',
      'src/config.ts'
    ];

    for (let i = 0; i < codeFiles.length; i++) {
      const file = codeFiles[i];
      sendSSE(res, 'log', { message: `  Parsing ${file}` });
      sendProgress(currentStep, 'Building code inventory', `Parsing ${file}`, (i + 1) / codeFiles.length * 0.7);
      await new Promise(r => setTimeout(r, 180));
    }

    sendSSE(res, 'log', { message: `  Found ${codeFiles.length} source files` });
    await new Promise(r => setTimeout(r, 150));

    // Extract code features
    sendProgress(currentStep, 'Building code inventory', 'Extracting code features...', 0.85);
    sendSSE(res, 'log', { message: '  Extracting code features and entities...' });
    await new Promise(r => setTimeout(r, 500));

    const codeFeatures = 12;
    const codeEntities = 8;
    sendSSE(res, 'log', { message: `  Found ${codeFeatures} code features` });
    sendSSE(res, 'log', { message: `  Found ${codeEntities} entities` });
    sendProgress(currentStep, 'Building code inventory', 'Done', 1);
    await new Promise(r => setTimeout(r, 250));

    // ==========================================
    // Phase 3: Matching features (slower - semantic analysis, stays at 60% longer)
    // ==========================================
    currentStep = 3;
    sendProgress(currentStep, 'Matching features', 'Comparing doc features with code...', 0);
    sendSSE(res, 'log', { message: '\nPhase 3: Matching features...' });
    await new Promise(r => setTimeout(r, 800));

    sendSSE(res, 'log', { message: '  Comparing documented features with code implementation...' });
    sendProgress(currentStep, 'Matching features', 'Running semantic comparison...', 0.2);
    await new Promise(r => setTimeout(r, 2000));

    sendSSE(res, 'log', { message: '  Running semantic similarity analysis...' });
    sendProgress(currentStep, 'Matching features', 'Computing similarity scores...', 0.4);
    await new Promise(r => setTimeout(r, 2500));

    sendSSE(res, 'log', { message: '  Building feature dependency graph...' });
    sendProgress(currentStep, 'Matching features', 'Building feature dependency graph...', 0.7);
    await new Promise(r => setTimeout(r, 1800));

    const matched = 7;
    const unmatchedDoc = 2;
    const unmatchedCode = 5;
    sendSSE(res, 'log', { message: `  Matched ${matched} features` });
    sendSSE(res, 'log', { message: `  Unmatched doc features: ${unmatchedDoc}` });
    sendSSE(res, 'log', { message: `  Unmatched code features: ${unmatchedCode}` });
    sendProgress(currentStep, 'Matching features', 'Done', 1);
    await new Promise(r => setTimeout(r, 500));

    // ==========================================
    // Phase 4: Detecting gaps (slowest - LLM analysis)
    // ==========================================
    currentStep = 4;
    sendProgress(currentStep, 'Detecting gaps', 'Initializing gap detection...', 0);
    sendSSE(res, 'log', { message: '\nPhase 4: Detecting gaps...' });
    await new Promise(r => setTimeout(r, 700));

    // Staleness detection
    sendSSE(res, 'log', { message: '  Checking for stale documentation...' });
    sendProgress(currentStep, 'Detecting gaps', 'Analyzing staleness patterns...', 0.1);
    await new Promise(r => setTimeout(r, 1500));

    const stalenessGaps = PREDETERMINED_GAPS.filter(g => g.gap_type === 'STALENESS');
    for (let i = 0; i < stalenessGaps.length; i++) {
      const gap = stalenessGaps[i];
      sendSSE(res, 'log', { message: `    [STALENESS] ${gap.doc_file}: ${gap.description.substring(0, 50)}...` });
      sendProgress(currentStep, 'Detecting gaps', `Found staleness in ${gap.doc_file}`, 0.1 + (i + 1) / stalenessGaps.length * 0.2);
      await new Promise(r => setTimeout(r, 700));
    }
    sendSSE(res, 'log', { message: `  Found ${stalenessGaps.length} staleness gaps` });
    await new Promise(r => setTimeout(r, 600));

    // Undocumented detection
    sendSSE(res, 'log', { message: '  Checking for undocumented features...' });
    sendProgress(currentStep, 'Detecting gaps', 'Scanning for undocumented code...', 0.35);
    await new Promise(r => setTimeout(r, 1800));

    const undocGaps = PREDETERMINED_GAPS.filter(g => g.gap_type === 'UNDOCUMENTED');
    for (let i = 0; i < undocGaps.length; i++) {
      const gap = undocGaps[i];
      sendSSE(res, 'log', { message: `    [UNDOCUMENTED] ${gap.doc_file}: ${gap.description.substring(0, 50)}...` });
      sendProgress(currentStep, 'Detecting gaps', `Found undocumented feature in ${gap.doc_file}`, 0.35 + (i + 1) / undocGaps.length * 0.3);
      await new Promise(r => setTimeout(r, 800));
    }
    sendSSE(res, 'log', { message: `  Found ${undocGaps.length} undocumented gaps` });
    await new Promise(r => setTimeout(r, 600));

    // Obsolete detection
    sendSSE(res, 'log', { message: '  Checking for obsolete documentation...' });
    sendProgress(currentStep, 'Detecting gaps', 'Identifying obsolete references...', 0.7);
    await new Promise(r => setTimeout(r, 1200));

    const obsoleteGaps = PREDETERMINED_GAPS.filter(g => g.gap_type === 'OBSOLETE');
    for (let i = 0; i < obsoleteGaps.length; i++) {
      const gap = obsoleteGaps[i];
      sendSSE(res, 'log', { message: `    [OBSOLETE] ${gap.doc_file}: ${gap.description.substring(0, 50)}...` });
      sendProgress(currentStep, 'Detecting gaps', `Found obsolete content in ${gap.doc_file}`, 0.7 + (i + 1) / obsoleteGaps.length * 0.25);
      await new Promise(r => setTimeout(r, 600));
    }
    sendSSE(res, 'log', { message: `  Found ${obsoleteGaps.length} obsolete gaps` });
    await new Promise(r => setTimeout(r, 500));

    // ==========================================
    // Summary
    // ==========================================
    sendProgress(totalSteps, 'Complete', 'Analysis finished');
    sendSSE(res, 'log', { message: '\n' + '='.repeat(50) });
    sendSSE(res, 'log', { message: 'ANALYSIS COMPLETE' });
    sendSSE(res, 'log', { message: '='.repeat(50) });
    sendSSE(res, 'log', { message: `Doc files scanned:    ${docFiles.length}` });
    sendSSE(res, 'log', { message: `Code files parsed:    ${codeFiles.length}` });
    sendSSE(res, 'log', { message: `Features matched:     ${matched}` });
    sendSSE(res, 'log', { message: `Total gaps found:     ${PREDETERMINED_GAPS.length}` });
    sendSSE(res, 'log', { message: `  - Staleness:        ${stalenessGaps.length}` });
    sendSSE(res, 'log', { message: `  - Undocumented:     ${undocGaps.length}` });
    sendSSE(res, 'log', { message: `  - Obsolete:         ${obsoleteGaps.length}` });
    sendSSE(res, 'log', { message: `High priority:        ${PREDETERMINED_GAPS.filter(g => g.severity === 'high' || g.severity === 'critical').length}` });

    // Send final result
    const result = {
      gaps: PREDETERMINED_GAPS,
      timestamp: new Date().toISOString(),
      summary: {
        total: PREDETERMINED_GAPS.length,
        by_severity: {
          critical: PREDETERMINED_GAPS.filter(g => g.severity === 'critical').length,
          high: PREDETERMINED_GAPS.filter(g => g.severity === 'high').length,
          medium: PREDETERMINED_GAPS.filter(g => g.severity === 'medium').length,
          low: PREDETERMINED_GAPS.filter(g => g.severity === 'low').length
        },
        by_type: {
          STALENESS: stalenessGaps.length,
          UNDOCUMENTED: undocGaps.length,
          OBSOLETE: obsoleteGaps.length
        }
      }
    };

    sendSSE(res, 'result', result);
    sendSSE(res, 'done', { success: true });

    broadcast({ type: 'ANALYSIS_COMPLETE', gapCount: PREDETERMINED_GAPS.length });

  } catch (error: any) {
    sendSSE(res, 'error', { message: error.message });
  }

  res.end();
});

// GET /analyze - Run documentation gap analysis (non-streaming fallback)
app.get('/analyze', requireAdmin, async (req, res) => {
  broadcast({ type: 'ANALYSIS_STARTED' });

  // Simulate analysis delay for realistic UX
  await new Promise(resolve => setTimeout(resolve, 1500));

  broadcast({ type: 'ANALYSIS_COMPLETE', gapCount: PREDETERMINED_GAPS.length });

  res.json({
    gaps: PREDETERMINED_GAPS,
    timestamp: new Date().toISOString(),
    summary: {
      total: PREDETERMINED_GAPS.length,
      by_severity: {
        critical: PREDETERMINED_GAPS.filter(g => g.severity === 'critical').length,
        high: PREDETERMINED_GAPS.filter(g => g.severity === 'high').length,
        medium: PREDETERMINED_GAPS.filter(g => g.severity === 'medium').length,
        low: PREDETERMINED_GAPS.filter(g => g.severity === 'low').length
      },
      by_type: {
        STALENESS: PREDETERMINED_GAPS.filter(g => g.gap_type === 'STALENESS').length,
        UNDOCUMENTED: PREDETERMINED_GAPS.filter(g => g.gap_type === 'UNDOCUMENTED').length,
        OBSOLETE: PREDETERMINED_GAPS.filter(g => g.gap_type === 'OBSOLETE').length
      }
    }
  });
});

// Helper: Get file content from GitHub
async function getFileContent(owner: string, repo: string, path: string, ref = 'main'): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if ('content' in data && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

// POST /fix-gaps - Create PR with selected gap fixes
app.post('/fix-gaps', requireAdmin, async (req, res) => {
  const { gapIds } = req.body;

  if (!gapIds || !Array.isArray(gapIds) || gapIds.length === 0) {
    return res.status(400).json({ error: 'gapIds array required' });
  }

  // Filter to selected gaps
  const selectedGaps = PREDETERMINED_GAPS.filter(g => gapIds.includes(g.id));

  if (selectedGaps.length === 0) {
    return res.status(400).json({ error: 'No valid gaps found for provided IDs' });
  }

  broadcast({ type: 'FIX_STARTED', gapCount: selectedGaps.length });

  try {
    // Group gaps by file
    const fileUpdates: Record<string, { gaps: DocGap[]; content: string }> = {};

    for (const gap of selectedGaps) {
      const filePath = gap.suggested_fix.file;

      if (!fileUpdates[filePath]) {
        // Fetch current content from GitHub
        const currentContent = await getFileContent(DOCS_REPO_OWNER, DOCS_REPO, filePath);
        if (!currentContent) {
          console.error(`Could not fetch ${filePath}`);
          continue;
        }
        fileUpdates[filePath] = { gaps: [], content: currentContent };
      }

      fileUpdates[filePath].gaps.push(gap);
    }

    // Apply fixes to each file
    for (const [filePath, { gaps, content }] of Object.entries(fileUpdates)) {
      let updatedContent = content;
      for (const gap of gaps) {
        updatedContent = updatedContent.replace(
          gap.suggested_fix.before,
          gap.suggested_fix.after
        );
      }
      fileUpdates[filePath].content = updatedContent;
    }

    // Create branch
    const branchName = `docs-fix-gaps-${Date.now()}`;

    const { data: refData } = await octokit.git.getRef({
      owner: DOCS_REPO_OWNER,
      repo: DOCS_REPO,
      ref: 'heads/main'
    });

    await octokit.git.createRef({
      owner: DOCS_REPO_OWNER,
      repo: DOCS_REPO,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha
    });

    broadcast({ type: 'BRANCH_CREATED', branch: branchName });

    // Commit each updated file
    for (const [filePath, { content }] of Object.entries(fileUpdates)) {
      await commitFile(
        DOCS_REPO_OWNER,
        DOCS_REPO,
        filePath,
        content,
        `docs: fix ${filePath} - address documentation gaps`,
        branchName
      );
      broadcast({ type: 'FILE_COMMITTED', file: filePath });
    }

    // Build PR description with gap details
    const gapDescriptions = selectedGaps.map(g =>
      `- **${g.gap_type}** (${g.severity}): ${g.description}`
    ).join('\n');

    // Create PR
    const { data: pr } = await octokit.pulls.create({
      owner: DOCS_REPO_OWNER,
      repo: DOCS_REPO,
      title: `docs: fix ${selectedGaps.length} documentation gap${selectedGaps.length > 1 ? 's' : ''}`,
      head: branchName,
      base: 'main',
      body: `## Documentation Gap Fixes

This PR addresses ${selectedGaps.length} documentation gap${selectedGaps.length > 1 ? 's' : ''} identified by the doc analyzer.

### Gaps Fixed
${gapDescriptions}

### Files Updated
${Object.keys(fileUpdates).map(f => `- \`${f}\``).join('\n')}

---
Generated by Oqoqo Doc Analyzer`
    });

    broadcast({ type: 'PR_CREATED', prNumber: pr.number, prUrl: pr.html_url });

    // Store as review for tracking
    const review: Review = {
      id: reviewIdCounter++,
      prNumber: pr.number,
      prUrl: pr.html_url,
      branch: branchName,
      files: Object.fromEntries(
        Object.entries(fileUpdates).map(([path, { content }]) => [
          path,
          { before: '', after: content }
        ])
      ),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    pendingReviews.set(review.id, review);

    res.json({
      success: true,
      prNumber: pr.number,
      prUrl: pr.html_url,
      fixedGaps: selectedGaps.length,
      filesUpdated: Object.keys(fileUpdates).length
    });

  } catch (error: any) {
    console.error('Fix gaps error:', error);
    broadcast({ type: 'FIX_ERROR', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access level: ${accessLevel}`);
  console.log(`Docs repo: ${DOCS_REPO_OWNER}/${DOCS_REPO}`);
  console.log(`Product repo: ${PRODUCT_REPO_OWNER}/${PRODUCT_REPO}`);
});
