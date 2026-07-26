import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, RefreshCw, Trash2 } from 'lucide-react'

import { DEFAULT_SUPPORTED_EXTENSIONS } from '@shared/types'

import { AIModelsSettings } from '@/components/settings/AIModelsSettings'
import { OllamaModelPicker } from '@/components/settings/OllamaModelPicker'
import { SettingsSection, SettingsTabs, type SettingsSection as SettingsTabId } from '@/components/settings/SettingsTabs'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { rebuildEmbeddings, syncEmbeddings } from '@/services/search-api'
import {
  deleteFolder,
  fetchFolders,
  fetchSettings,
  pickAndRegisterFolders,
  resyncAndScanFolder,
  runMaintenance,
  updateSettings,
} from '@/services/documents-api'
import { SettingsFormSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/stores/toast-store'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [extensionsText, setExtensionsText] = useState('')
  const [ignoredText, setIgnoredText] = useState('')
  const [activeSection, setActiveSection] = useState<SettingsTabId>('general')

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const foldersQuery = useQuery({ queryKey: ['folders'], queryFn: fetchFolders })

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      toast({ level: 'success', title: 'Settings saved' })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['embedding-status'] })
      void queryClient.invalidateQueries({ queryKey: ['ollama-models'] })
      void queryClient.invalidateQueries({ queryKey: ['copilot-context'] })
      void window.orbit?.resyncWatcher()
    },
  })

  const maintenanceMutation = useMutation({
    mutationFn: () => runMaintenance({ pruneRemoved: true, recomputeDuplicateFlags: true }),
  })

  const settings = settingsQuery.data

  if (settingsQuery.isLoading) {
    return (
      <>
        <PageHeader
          title="Settings"
          description="Indexing folders, supported formats, notifications, and database maintenance."
        />
        <SettingsFormSkeleton />
      </>
    )
  }

  if (settingsQuery.isError || !settings) {
    return (
      <ErrorState
        message={
          settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Failed to load settings'
        }
        onRetry={() => void settingsQuery.refetch()}
      />
    )
  }

  const extensionsValue =
    extensionsText || settings.supportedExtensions.join(', ') || DEFAULT_SUPPORTED_EXTENSIONS.join(', ')
  const ignoredValue =
    ignoredText || settings.ignoredDirectoryNames.join(', ')

  return (
    <>
      <PageHeader
        title="Settings"
        description="Indexing folders, supported formats, notifications, and database maintenance."
      />

      <SettingsTabs active={activeSection} onChange={setActiveSection} />

      <SettingsSection id="general" active={activeSection}>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Indexed folders</h2>
            <Button variant="secondary" size="sm" onClick={() => void pickAndRegisterFolders().then(() => queryClient.invalidateQueries({ queryKey: ['folders'] })).catch(console.error)}>
              <FolderPlus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            {(foldersQuery.data ?? []).map((folder) => (
              <li
                key={folder.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-orbit-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{folder.label}</p>
                  <p className="truncate text-xs text-orbit-foreground-muted">{folder.path}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void resyncAndScanFolder(folder).catch(console.error)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void deleteFolder(folder.id)
                        .then(() => queryClient.invalidateQueries({ queryKey: ['folders'] }))
                        .then(() => window.orbit?.resyncWatcher())
                        .catch(console.error)
                    }
                  >
                    <Trash2 className="h-4 w-4 text-orbit-danger" />
                  </Button>
                </div>
              </li>
            ))}
            {(foldersQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-orbit-foreground-muted">No folders configured yet.</p>
            ) : null}
          </ul>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold">Indexing behaviour</h2>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Auto-index on file changes</span>
            <Switch
              checked={settings.autoIndexOnChange}
              onCheckedChange={(checked) => saveMutation.mutate({ autoIndexOnChange: checked })}
              label="Auto-index on file changes"
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Index on startup</span>
            <Switch
              checked={settings.autoIndexOnStartup}
              onCheckedChange={(checked) => saveMutation.mutate({ autoIndexOnStartup: checked })}
              label="Index on startup"
            />
          </label>
          <label className="block text-sm">
            <span className="text-orbit-foreground-muted">Max file size (MB)</span>
            <Input
              type="number"
              className="mt-1"
              defaultValue={settings.maxFileSizeMb}
              onBlur={(e) => saveMutation.mutate({ maxFileSizeMb: Number(e.target.value) })}
            />
          </label>
        </Card>
      </SettingsSection>

      <SettingsSection id="indexing" active={activeSection}>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Ignored directory names</h2>
          <Input
            value={ignoredValue}
            onChange={(e) => setIgnoredText(e.target.value)}
            onBlur={() =>
              saveMutation.mutate({
                ignoredDirectoryNames: ignoredValue.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <p className="text-xs text-orbit-foreground-muted">Comma-separated folder names skipped during scans.</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Supported extensions</h2>
          <Input
            value={extensionsValue}
            onChange={(e) => setExtensionsText(e.target.value)}
            onBlur={() =>
              saveMutation.mutate({
                supportedExtensions: extensionsValue.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <p className="text-xs text-orbit-foreground-muted">Include leading dots, e.g. .pdf, .docx</p>
        </Card>
      </SettingsSection>

      <SettingsSection id="notifications" active={activeSection}>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {(
            [
              ['indexingComplete', 'Indexing completed'],
              ['indexingErrors', 'Indexing errors'],
              ['watcherEvents', 'File watcher events'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <Switch
                checked={settings.notifications[key]}
                onCheckedChange={(checked) =>
                  saveMutation.mutate({
                    notifications: { ...settings.notifications, [key]: checked },
                  })
                }
                label={label}
              />
            </label>
          ))}
        </Card>
      </SettingsSection>

      <SettingsSection id="ai" active={activeSection}>
        <AIModelsSettings settings={settings} onSave={(patch) => saveMutation.mutate(patch)} />
        <Card className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold">Embeddings & vectors</h2>
          <label className="block text-sm">
            <span className="text-orbit-foreground-muted">Ollama base URL</span>
            <Input
              className="mt-1"
              defaultValue={settings.ollamaBaseUrl}
              placeholder="http://127.0.0.1:11434"
              onBlur={(e) => saveMutation.mutate({ ollamaBaseUrl: e.target.value.trim() })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-orbit-foreground-muted">Provider</span>
            <Select
              className="mt-1 w-full"
              value={settings.embeddingProvider}
              onChange={(e) =>
                saveMutation.mutate({
                  embeddingProvider: e.target.value as 'sentence-transformers' | 'ollama',
                })
              }
            >
              <option value="sentence-transformers">Sentence Transformers (local)</option>
              <option value="ollama">Ollama</option>
            </Select>
          </label>
          {settings.embeddingProvider === 'ollama' ? (
            <OllamaModelPicker
              label="Embedding model"
              value={settings.embeddingModel}
              baseUrl={settings.ollamaBaseUrl}
              onChange={(embeddingModel) => saveMutation.mutate({ embeddingModel })}
            />
          ) : (
            <label className="block text-sm">
              <span className="text-orbit-foreground-muted">Model</span>
              <Input
                className="mt-1"
                defaultValue={settings.embeddingModel}
                placeholder="all-MiniLM-L6-v2"
                onBlur={(e) => saveMutation.mutate({ embeddingModel: e.target.value })}
              />
            </label>
          )}
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Auto-generate embeddings on index</span>
            <Switch
              checked={settings.autoEmbedOnIndex}
              onCheckedChange={(checked) => saveMutation.mutate({ autoEmbedOnIndex: checked })}
              label="Auto-generate embeddings on index"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-orbit-foreground-muted">Chunk size</span>
              <Input
                type="number"
                className="mt-1"
                defaultValue={settings.chunkSize}
                onBlur={(e) => saveMutation.mutate({ chunkSize: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-orbit-foreground-muted">Overlap</span>
              <Input
                type="number"
                className="mt-1"
                defaultValue={settings.chunkOverlap}
                onBlur={(e) => saveMutation.mutate({ chunkOverlap: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => void syncEmbeddings().catch(console.error)}>
              Sync embeddings
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void rebuildEmbeddings().catch(console.error)}>
              Rebuild vector index
            </Button>
          </div>
        </Card>
      </SettingsSection>

      <SettingsSection id="maintenance" active={activeSection}>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Database maintenance</h2>
          <p className="text-sm text-orbit-foreground-muted">
            Remove stale records and recompute duplicate flags across indexed content hashes.
          </p>
          <Button
            variant="secondary"
            loading={maintenanceMutation.isPending}
            onClick={() => maintenanceMutation.mutate()}
          >
            Run maintenance
          </Button>
          {maintenanceMutation.data ? (
            <p className="text-xs text-orbit-foreground-muted">
              Pruned {maintenanceMutation.data.prunedRemovedRecords} records · duplicates recomputed:{' '}
              {maintenanceMutation.data.duplicatesRecomputed ? 'yes' : 'no'}
            </p>
          ) : null}
        </Card>
      </SettingsSection>
    </>
  )
}
