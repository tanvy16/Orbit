import { useQuery } from '@tanstack/react-query'
import { Check, Cpu } from 'lucide-react'

import { OllamaModelPicker } from '@/components/settings/OllamaModelPicker'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchOllamaModels } from '@/services/ollama-api'
import type { OrbitAppSettings } from '@shared/types'
import { cn } from '@/utils/cn'

interface AIModelsSettingsProps {
  settings: OrbitAppSettings
  onSave: (patch: Partial<OrbitAppSettings>) => void
}

export function AIModelsSettings({ settings, onSave }: AIModelsSettingsProps) {
  const modelsQuery = useQuery({
    queryKey: ['ollama-models', settings.ollamaBaseUrl],
    queryFn: () => fetchOllamaModels(settings.ollamaBaseUrl),
    staleTime: 30_000,
  })

  const models = modelsQuery.data?.models ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-orbit-accent" />
          <h2 className="text-sm font-semibold">AI Provider</h2>
        </div>
        <label className="block text-sm">
          <span className="text-orbit-foreground-muted">Provider</span>
          <Select
            className="mt-1 w-full"
            value={settings.copilotProvider}
            onChange={(e) =>
              onSave({ copilotProvider: e.target.value as 'ollama' | 'openai' })
            }
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI</option>
          </Select>
        </label>
        {settings.copilotProvider === 'ollama' ? (
          <OllamaModelPicker
            label="Local model"
            value={settings.copilotModel}
            baseUrl={settings.ollamaBaseUrl}
            onChange={(copilotModel) => onSave({ copilotModel })}
          />
        ) : (
          <label className="block text-sm">
            <span className="text-orbit-foreground-muted">Model</span>
            <input
              className="mt-1 h-9 w-full rounded-lg border border-orbit-border bg-orbit-surface px-3 text-sm"
              defaultValue={settings.copilotModel}
              placeholder="gpt-4o-mini"
              onBlur={(e) => onSave({ copilotModel: e.target.value })}
            />
          </label>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Installed Models</h2>
        <p className="mt-1 text-xs text-orbit-foreground-muted">
          Discovered dynamically from Ollama — no hardcoded list.
        </p>
        {modelsQuery.isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : null}
        {modelsQuery.data && !modelsQuery.data.ok ? (
          <p className="mt-4 text-sm text-orbit-danger">
            {modelsQuery.data.error ?? 'Could not reach Ollama.'}
          </p>
        ) : null}
        {models.length ? (
          <ul className="mt-4 space-y-2">
            {models.map((model) => {
              const selected = model.name === settings.copilotModel
              return (
                <li
                  key={model.name}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                    selected
                      ? 'border-orbit-accent/40 bg-orbit-accent/10'
                      : 'border-orbit-border/70',
                  )}
                >
                  <span className="font-medium">{model.name}</span>
                  {selected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-orbit-accent hover:underline"
                      onClick={() => onSave({ copilotModel: model.name })}
                    >
                      Use model
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          !modelsQuery.isLoading && (
            <p className="mt-4 text-sm text-orbit-foreground-muted">
              No models found. Pull a model with Ollama, then refresh.
            </p>
          )
        )}
      </Card>
    </div>
  )
}
