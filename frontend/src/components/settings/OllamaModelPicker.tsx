import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

import type { OllamaModelDto } from '@shared/types'

import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { fetchOllamaModels } from '@/services/ollama-api'

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function formatModified(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function modelLabel(model: OllamaModelDto): string {
  return `${model.name} · ${formatSize(model.sizeBytes)} · ${formatModified(model.modifiedAt)}`
}

interface OllamaModelPickerProps {
  label: string
  value: string
  baseUrl: string
  onChange: (model: string) => void
  disabled?: boolean
}

export function OllamaModelPicker({
  label,
  value,
  baseUrl,
  onChange,
  disabled,
}: OllamaModelPickerProps) {
  const modelsQuery = useQuery({
    queryKey: ['ollama-models', baseUrl],
    queryFn: () => fetchOllamaModels(baseUrl),
    staleTime: 30_000,
    retry: false,
  })

  const models = modelsQuery.data?.models ?? []
  const selected = models.find((model) => model.name === value)
  const hasCurrentValue = Boolean(value)
  const valueMissingFromList = hasCurrentValue && !selected

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-orbit-foreground-muted">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={modelsQuery.isFetching || disabled}
          onClick={() => void modelsQuery.refetch()}
        >
          <RefreshCw className={`h-4 w-4 ${modelsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh models
        </Button>
      </div>

      {modelsQuery.isLoading ? (
        <Spinner size="sm" label="Loading Ollama models…" />
      ) : null}

      {modelsQuery.data && !modelsQuery.data.ok ? (
        <ErrorState
          compact
          title="Ollama unavailable"
          message={modelsQuery.data.error ?? 'Could not reach Ollama.'}
          onRetry={() => void modelsQuery.refetch()}
        />
      ) : null}

      {modelsQuery.data?.ok ? (
        <>
          <Select
            className="w-full"
            value={value}
            disabled={disabled || models.length === 0}
            onChange={(e) => onChange(e.target.value)}
          >
            {valueMissingFromList ? (
              <option value={value}>{value} (saved, not in local Ollama list)</option>
            ) : null}
            {!hasCurrentValue ? <option value="">Select a model…</option> : null}
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {modelLabel(model)}
              </option>
            ))}
          </Select>
          {selected ? (
            <p className="text-xs text-orbit-foreground-muted">
              Selected: {selected.name} · {formatSize(selected.sizeBytes)} · updated{' '}
              {formatModified(selected.modifiedAt)}
            </p>
          ) : null}
          {models.length === 0 ? (
            <p className="text-xs text-orbit-foreground-muted">
              No models found. Pull one with Ollama, then refresh.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
