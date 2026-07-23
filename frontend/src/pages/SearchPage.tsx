import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Search } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { SearchResultsSkeleton } from '@/components/ui/Skeleton'
import { fetchDocumentStats, fetchFolders } from '@/services/documents-api'
import { openDocumentPath, semanticSearch } from '@/services/search-api'

function HighlightedSnippet({ text }: { text: string }) {
  const parts = text.split(/(«[^»]+»)/g)
  return (
    <p className="text-sm leading-relaxed text-orbit-foreground-muted">
      {parts.map((part, index) =>
        part.startsWith('«') && part.endsWith('»') ? (
          <mark key={index} className="rounded bg-orbit-accent/25 px-0.5 text-orbit-foreground">
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  )
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [folderId, setFolderId] = useState<number | undefined>()
  const [extension, setExtension] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const foldersQuery = useQuery({
    queryKey: ['folders'],
    queryFn: fetchFolders,
    retry: 1,
  })
  const statsQuery = useQuery({
    queryKey: ['document-stats'],
    queryFn: fetchDocumentStats,
    retry: 1,
  })

  const searchQuery = useQuery({
    queryKey: ['semantic-search', submittedQuery, page, folderId, extension],
    queryFn: () =>
      semanticSearch({
        query: submittedQuery,
        page,
        pageSize: 10,
        folderId,
        extension: extension || undefined,
      }),
    enabled: submittedQuery.length > 0,
    retry: 1,
  })

  const runSearch = () => {
    setPage(1)
    setSubmittedQuery(query.trim())
  }

  const extensionOptions = Object.keys(statsQuery.data?.byExtension ?? {}).sort()
  const showSearchSpinner = searchQuery.isFetching && submittedQuery.length > 0

  return (
    <>
      <PageHeader
        title="Semantic Search"
        description="Search by meaning across indexed documents — powered by local embeddings and ChromaDB."
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-foreground-muted" />
            <Input
              className="pl-9"
              placeholder="Ask in natural language — e.g. “budget spreadsheet from last quarter”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
            />
          </div>
          <Select
            className="min-w-[160px]"
            value={folderId ?? ''}
            onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All folders</option>
            {(foldersQuery.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select
            className="min-w-[140px]"
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
          >
            <option value="">All types</option>
            {extensionOptions.map((ext) => (
              <option key={ext} value={ext}>
                {ext}
              </option>
            ))}
          </Select>
          <Button onClick={runSearch} disabled={!query.trim() || showSearchSpinner}>
            Search
          </Button>
        </div>
      </Card>

      {showSearchSpinner ? (
        <SearchResultsSkeleton />
      ) : null}

      {searchQuery.isError && submittedQuery ? (
        <ErrorState
          message={searchQuery.error instanceof Error ? searchQuery.error.message : 'Search failed'}
          onRetry={() => void searchQuery.refetch()}
        />
      ) : null}

      {submittedQuery &&
      searchQuery.isSuccess &&
      searchQuery.data.items.length === 0 &&
      !showSearchSpinner ? (
        <EmptyState
          icon={Search}
          showLogo
          title="No semantic matches"
          description="Try different wording, remove filters, or wait for embeddings to finish generating."
        />
      ) : null}

      {searchQuery.isSuccess && searchQuery.data.items.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            {searchQuery.data.items.map((item) => (
              <div
                key={`${item.documentId}-${item.chunkId}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelectedPath(item.path)
                }}
                onClick={() => setSelectedPath(item.path)}
              >
                <Card className="transition-all duration-200 hover:border-orbit-accent/30 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.fileName}</p>
                      <p className="text-xs text-orbit-foreground-muted">{item.path}</p>
                    </div>
                    <Badge variant="accent">{Math.round(item.similarity * 100)}% match</Badge>
                  </div>
                  <div className="mt-3">
                    <HighlightedSnippet text={item.snippet} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Badge variant="muted">{item.extension}</Badge>
                    <Badge variant="muted">{item.embeddingStatus}</Badge>
                  </div>
                </Card>
              </div>
            ))}

            {searchQuery.data.totalPages > 1 ? (
              <div className="flex justify-between pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="self-center text-xs text-orbit-foreground-muted">
                  Page {searchQuery.data.page} / {searchQuery.data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= searchQuery.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>

          <Card className="h-fit lg:col-span-2">
            <h3 className="text-sm font-semibold">Document preview</h3>
            {selectedPath ? (
              <>
                <p className="mt-2 break-all text-xs text-orbit-foreground-muted">{selectedPath}</p>
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => void openDocumentPath(selectedPath).catch(console.error)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open original
                </Button>
              </>
            ) : (
              <p className="mt-2 text-sm text-orbit-foreground-muted">
                Select a result to preview and open the file.
              </p>
            )}
          </Card>
        </div>
      ) : null}
    </>
  )
}
