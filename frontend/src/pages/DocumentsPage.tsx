import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, FolderOpen, RefreshCw, Search } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import {
  fetchDocumentStats,
  fetchDocuments,
  fetchFolders,
  pickAndRegisterFolders,
  resyncAndScanFolder,
} from '@/services/documents-api'
import { fetchActiveTasks } from '@/services/notifications-api'
import { cn } from '@/utils/cn'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [extension, setExtension] = useState('')
  const [folderId, setFolderId] = useState<number | undefined>()
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const statsQuery = useQuery({ queryKey: ['document-stats'], queryFn: fetchDocumentStats })
  const foldersQuery = useQuery({ queryKey: ['folders'], queryFn: fetchFolders })
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: fetchActiveTasks,
    refetchInterval: 3000,
  })

  const documentsQuery = useQuery({
    queryKey: ['documents', page, search, extension, folderId, sortBy, sortDir],
    queryFn: () =>
      fetchDocuments({
        page,
        pageSize: 20,
        sortBy,
        sortDir,
        extension: extension || undefined,
        folderId,
        search: search || undefined,
      }),
  })

  const extensionOptions = useMemo(() => {
    const stats = statsQuery.data?.byExtension ?? {}
    return Object.keys(stats).sort()
  }, [statsQuery.data])

  const activeTask = tasksQuery.data?.[0]

  return (
    <>
      <PageHeader
        title="Documents"
        description="Local document index — metadata and hashes prepared for semantic search in Phase 3."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void pickAndRegisterFolders().catch(console.error)}>
              <FolderOpen className="h-4 w-4" />
              Add folders
            </Button>
          </div>
        }
      />

      {activeTask ? (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Background indexing</p>
              <p className="text-xs text-orbit-foreground-muted truncate max-w-xl">
                {activeTask.currentPath ?? activeTask.taskType}
              </p>
            </div>
            <Badge variant="accent">{activeTask.status}</Badge>
          </div>
          <ProgressBar className="mt-3" value={activeTask.progressPercent} />
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Indexed</p>
          <p className="mt-1 text-2xl font-semibold">{statsQuery.data?.totalIndexed ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Pending</p>
          <p className="mt-1 text-2xl font-semibold">{statsQuery.data?.totalPending ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Duplicates</p>
          <p className="mt-1 text-2xl font-semibold">{statsQuery.data?.totalDuplicates ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Watched folders</p>
          <p className="mt-1 text-2xl font-semibold">{statsQuery.data?.watchedFolders ?? '—'}</p>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-orbit-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-foreground-muted" />
            <Input
              className="pl-9"
              placeholder="Search file names…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={extension}
            onChange={(e) => {
              setExtension(e.target.value)
              setPage(1)
            }}
            className="min-w-[140px]"
          >
            <option value="">All types</option>
            {extensionOptions.map((ext) => (
              <option key={ext} value={ext}>
                {ext}
              </option>
            ))}
          </Select>
          <Select
            value={folderId ?? ''}
            onChange={(e) => {
              setFolderId(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
            className="min-w-[180px]"
          >
            <option value="">All folders</option>
            {(foldersQuery.data ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </Select>
          <Select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [by, dir] = e.target.value.split(':')
              setSortBy(by ?? 'updatedAt')
              setSortDir((dir as 'asc' | 'desc') ?? 'desc')
            }}
          >
            <option value="updatedAt:desc">Recently updated</option>
            <option value="fileName:asc">Name (A–Z)</option>
            <option value="sizeBytes:desc">Largest first</option>
            <option value="modifiedAt:desc">Modified</option>
          </Select>
        </div>

        {documentsQuery.isLoading ? (
          <div className="p-12">
            <Spinner label="Loading documents…" />
          </div>
        ) : null}

        {documentsQuery.isError ? (
          <div className="p-6">
            <ErrorState
              message={
                documentsQuery.error instanceof Error
                  ? documentsQuery.error.message
                  : 'Failed to load documents'
              }
              onRetry={() => void documentsQuery.refetch()}
            />
          </div>
        ) : null}

        {documentsQuery.data && documentsQuery.data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <FileText className="h-10 w-10 text-orbit-foreground-muted" />
            <p className="text-sm font-medium">No indexed documents yet</p>
            <p className="max-w-md text-sm text-orbit-foreground-muted">
              Add folders from Settings or use &quot;Add folders&quot; to start indexing.
            </p>
          </div>
        ) : null}

        {documentsQuery.data && documentsQuery.data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-orbit-muted/40 text-left text-xs uppercase tracking-wide text-orbit-foreground-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Folder</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {documentsQuery.data.items.map((doc) => (
                  <tr key={doc.id} className="border-t border-orbit-border hover:bg-orbit-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{doc.fileName}</p>
                      <p className="max-w-md truncate text-xs text-orbit-foreground-muted">{doc.path}</p>
                    </td>
                    <td className="px-4 py-3 text-orbit-foreground-muted">
                      {doc.watchedFolderPath ?? '—'}
                    </td>
                    <td className="px-4 py-3">{doc.extension || '—'}</td>
                    <td className="px-4 py-3">{formatBytes(doc.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={doc.indexStatus === 'indexed' ? 'default' : 'muted'}
                        className={cn(doc.isDuplicate && 'mr-1')}
                      >
                        {doc.indexStatus}
                      </Badge>
                      {doc.isDuplicate ? <Badge variant="muted">duplicate</Badge> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {documentsQuery.data && documentsQuery.data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-orbit-border px-4 py-3">
            <p className="text-xs text-orbit-foreground-muted">
              Page {documentsQuery.data.page} of {documentsQuery.data.totalPages} ·{' '}
              {documentsQuery.data.total} files
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= documentsQuery.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {(foldersQuery.data ?? []).length > 0 ? (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold">Watched folders</h2>
          <ul className="mt-3 space-y-2">
            {foldersQuery.data?.map((folder) => (
              <li
                key={folder.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orbit-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{folder.label}</p>
                  <p className="text-xs text-orbit-foreground-muted">{folder.path}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{folder.indexedFileCount} files</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void resyncAndScanFolder(folder).catch(console.error)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-index
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  )
}
