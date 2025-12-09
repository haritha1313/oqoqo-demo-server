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
    description: 'Users endpoint table is missing DELETE and PATCH methods that exist in the API',
    evidence: 'Code has DELETE /users/:id and PATCH /users/:id endpoints but docs only show GET and POST',
    suggested_fix: {
      file: 'docs/getting-started.md',
      before: `### Users

Manage user accounts in your application.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/users\` | List all users |
| POST | \`/users\` | Create a new user |
| GET | \`/users/:id\` | Get a user by ID |

#### Example: List Users`,
      after: `### Users

Manage user accounts in your application.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/users\` | List all users |
| POST | \`/users\` | Create a new user |
| GET | \`/users/:id\` | Get a user by ID |
| PATCH | \`/users/:id\` | Update a user |
| DELETE | \`/users/:id\` | Delete a user |

#### Example: List Users`
    }
  },
  {
    id: 'gap_002',
    gap_type: 'UNDOCUMENTED',
    severity: 'medium',
    doc_file: 'docs/concepts/pipelines.md',
    description: 'Pipeline batch processing mode is implemented but not documented',
    evidence: 'Found execution_mode="batch" option in Pipeline class but not in docs',
    suggested_fix: {
      file: 'docs/concepts/pipelines.md',
      before: `### Execution Modes

| Mode | Description |
|------|-------------|
| \`sequential\` | Tasks run one at a time in dependency order |
| \`parallel\` | Independent tasks run concurrently |
| \`async\` | Full async execution for I/O-bound workloads |

## Defining Tasks`,
      after: `### Execution Modes

| Mode | Description |
|------|-------------|
| \`sequential\` | Tasks run one at a time in dependency order |
| \`parallel\` | Independent tasks run concurrently |
| \`async\` | Full async execution for I/O-bound workloads |
| \`batch\` | Process records in configurable batch sizes |

#### Batch Mode Configuration

\`\`\`python
pipeline = Pipeline(
    "batch-processor",
    execution_mode="batch",
    batch_size=1000,           # Records per batch
    batch_timeout=30.0,        # Max seconds to fill a batch
)
\`\`\`

## Defining Tasks`
    }
  },
  {
    id: 'gap_003',
    gap_type: 'STALENESS',
    severity: 'low',
    doc_file: 'docs/api/pipeline-reference.md',
    description: 'Default max_parallel_tasks value changed from 4 to 8 in latest release',
    evidence: 'Code shows DEFAULT_MAX_PARALLEL = 8 but docs say default is 4',
    suggested_fix: {
      file: 'docs/api/pipeline-reference.md',
      before: `| \`max_parallel_tasks\` | \`int\` | \`4\` | Maximum concurrent tasks in parallel mode |`,
      after: `| \`max_parallel_tasks\` | \`int\` | \`8\` | Maximum concurrent tasks in parallel mode |`
    }
  },
  {
    id: 'gap_004',
    gap_type: 'UNDOCUMENTED',
    severity: 'high',
    doc_file: 'docs/guides/connectors.md',
    description: 'Elasticsearch connector is available but not documented',
    evidence: 'Found ElasticsearchSource and ElasticsearchSink in mosayc.connectors module',
    suggested_fix: {
      file: 'docs/guides/connectors.md',
      before: `### Chroma

\`\`\`python
from mosayc.connectors import ChromaSource, ChromaSink

source = ChromaSource(
    collection_name="documents",
    persist_directory="./chroma_data",
)

# Query by text (Chroma generates embeddings)
results = source.query(
    query_texts=["What is machine learning?"],
    n_results=5,
)
\`\`\`

## LLM Provider Connectors`,
      after: `### Chroma

\`\`\`python
from mosayc.connectors import ChromaSource, ChromaSink

source = ChromaSource(
    collection_name="documents",
    persist_directory="./chroma_data",
)

# Query by text (Chroma generates embeddings)
results = source.query(
    query_texts=["What is machine learning?"],
    n_results=5,
)
\`\`\`

### Elasticsearch

\`\`\`python
from mosayc.connectors import ElasticsearchSource, ElasticsearchSink

source = ElasticsearchSource(
    hosts=["http://localhost:9200"],
    index="documents",
    api_key="your-api-key",  # Optional
)

# Search with query DSL
results = source.search({
    "query": {
        "match": {"content": "machine learning"}
    },
    "size": 10,
})

# Bulk index documents
sink = ElasticsearchSink(
    hosts=["http://localhost:9200"],
    index="processed-documents",
)

sink.write([
    {"_id": "doc-1", "title": "Hello", "content": "World"},
    {"_id": "doc-2", "title": "Foo", "content": "Bar"},
])
\`\`\`

## LLM Provider Connectors`
    }
  },
  {
    id: 'gap_005',
    gap_type: 'OBSOLETE',
    severity: 'low',
    doc_file: 'docs/concepts/context.md',
    description: 'Documentation references deprecated log_level parameter',
    evidence: 'log_level was moved to LogConfig in v1.2.0, direct parameter is deprecated',
    suggested_fix: {
      file: 'docs/concepts/context.md',
      before: `## Creating a Context

\`\`\`python
from mosayc import Context

ctx = Context(
    env="production",
    log_level="info",
    enable_metrics=True,
    enable_tracing=True,
    project_id="my-project",
)
\`\`\``,
      after: `## Creating a Context

\`\`\`python
from mosayc import Context, LogConfig

ctx = Context(
    env="production",
    log_config=LogConfig(level="info", format="json"),
    enable_metrics=True,
    enable_tracing=True,
    project_id="my-project",
)
\`\`\``
    }
  },
  {
    id: 'gap_006',
    gap_type: 'UNDOCUMENTED',
    severity: 'medium',
    doc_file: 'docs/examples/rag-pipeline.md',
    description: 'Hybrid search (keyword + vector) feature is not documented in RAG example',
    evidence: 'PineconeSource.hybrid_query() method exists but not shown in examples',
    suggested_fix: {
      file: 'docs/examples/rag-pipeline.md',
      before: `## Querying the Index

After ingestion, query the vector database:

\`\`\`python
from mosayc.connectors import PineconeSource, OpenAITransform

# Initialize
source = PineconeSource(
    index_name=os.getenv("PINECONE_INDEX"),
    namespace="production",
)
embedder = OpenAITransform()

def search(query: str, top_k: int = 5):
    """Search for relevant documents."""
    # Generate query embedding
    query_embedding = embedder.embed([query]).embeddings[0]

    # Search Pinecone
    results = source.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
    )

    return [
        {
            "title": r.metadata.get("title"),
            "content": r.metadata.get("content"),
            "score": r.score,
        }
        for r in results
    ]

# Example search
results = search("How do I configure authentication?")
for r in results:
    print(f"{r['title']} (score: {r['score']:.3f})")
    print(f"  {r['content'][:200]}...")
\`\`\``,
      after: `## Querying the Index

After ingestion, query the vector database:

\`\`\`python
from mosayc.connectors import PineconeSource, OpenAITransform

# Initialize
source = PineconeSource(
    index_name=os.getenv("PINECONE_INDEX"),
    namespace="production",
)
embedder = OpenAITransform()

def search(query: str, top_k: int = 5):
    """Search for relevant documents."""
    # Generate query embedding
    query_embedding = embedder.embed([query]).embeddings[0]

    # Search Pinecone
    results = source.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
    )

    return [
        {
            "title": r.metadata.get("title"),
            "content": r.metadata.get("content"),
            "score": r.score,
        }
        for r in results
    ]

# Example search
results = search("How do I configure authentication?")
for r in results:
    print(f"{r['title']} (score: {r['score']:.3f})")
    print(f"  {r['content'][:200]}...")
\`\`\`

### Hybrid Search

Combine keyword and vector search for better results:

\`\`\`python
def hybrid_search(query: str, top_k: int = 5, alpha: float = 0.5):
    """
    Hybrid search combining sparse (keyword) and dense (vector) retrieval.

    Args:
        query: Search query text
        top_k: Number of results to return
        alpha: Balance between keyword (0) and vector (1) search
    """
    query_embedding = embedder.embed([query]).embeddings[0]

    results = source.hybrid_query(
        vector=query_embedding,
        sparse_vector=embedder.sparse_embed([query]).vectors[0],
        top_k=top_k,
        alpha=alpha,
        include_metadata=True,
    )

    return results

# Alpha=0.7 favors semantic similarity
results = hybrid_search("authentication setup", alpha=0.7)
\`\`\``
    }
  },
  {
    id: 'gap_007',
    gap_type: 'STALENESS',
    severity: 'medium',
    doc_file: 'docs/guides/observability.md',
    description: 'Tracer endpoint URL has changed to new domain',
    evidence: 'Code uses telemetry.mosayc.io but docs show telemetry.mosayc.dev',
    suggested_fix: {
      file: 'docs/guides/observability.md',
      before: `### Setting Up the Tracer

\`\`\`python
from mosayc import Pipeline
from mosayc.observability import MosaycTracer

# Create tracer
tracer = MosaycTracer(
    endpoint="https://telemetry.mosayc.dev",
    project_id="my-project",
    api_key="your-api-key",
    sample_rate=1.0,  # Trace 100% of requests
)

# Attach to pipeline
pipeline = Pipeline("traced-pipeline", tracer=tracer)
\`\`\``,
      after: `### Setting Up the Tracer

\`\`\`python
from mosayc import Pipeline
from mosayc.observability import MosaycTracer

# Create tracer
tracer = MosaycTracer(
    endpoint="https://telemetry.mosayc.io",  # Updated endpoint
    project_id="my-project",
    api_key="your-api-key",
    sample_rate=1.0,  # Trace 100% of requests
)

# Attach to pipeline
pipeline = Pipeline("traced-pipeline", tracer=tracer)
\`\`\``
    }
  },
  {
    id: 'gap_008',
    gap_type: 'UNDOCUMENTED',
    severity: 'high',
    doc_file: 'docs/concepts/tasks.md',
    description: 'Task priority feature is not documented',
    evidence: 'Found priority parameter in @task decorator but not mentioned in docs',
    suggested_fix: {
      file: 'docs/concepts/tasks.md',
      before: `### Tags

Add metadata for filtering and grouping:

\`\`\`python
@pipeline.task(tags={"type": "io", "priority": "high"})
def tagged_task():
    pass
\`\`\`

## Task Decorators`,
      after: `### Tags

Add metadata for filtering and grouping:

\`\`\`python
@pipeline.task(tags={"type": "io", "priority": "high"})
def tagged_task():
    pass
\`\`\`

### Priority

Control task execution order when multiple tasks are ready:

\`\`\`python
@pipeline.task(priority=10)  # Higher priority, runs first
def critical_task():
    pass

@pipeline.task(priority=1)   # Lower priority, runs later
def background_task():
    pass
\`\`\`

Priority values range from 1 (lowest) to 10 (highest). Default is 5.

## Task Decorators`
    }
  }
];

// Get the full updated content for a file with a specific gap fix applied
export function applyGapFix(gap: DocGap, currentContent: string): string {
  return currentContent.replace(gap.suggested_fix.before, gap.suggested_fix.after);
}
