import { FileText } from 'lucide-react'
import { motion } from 'framer-motion'

import { Badge } from '@/components/ui/Badge'
import type { CopilotChatResponse } from '@shared/types'

interface DocumentCitationsProps {
  sources: CopilotChatResponse['documentSources']
}

export function DocumentCitations({ sources }: DocumentCitationsProps) {
  const items = sources.filter((s) => s.fileName)
  if (!items.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 border-t border-orbit-border/60 pt-3"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orbit-foreground-muted">
        Sources
      </p>
      <ul className="space-y-2">
        {items.map((source, index) => (
          <li
            key={`${source.documentId ?? source.fileName}-${index}`}
            className="flex items-start gap-2.5 rounded-lg border border-orbit-border/70 bg-orbit-background/50 px-3 py-2"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-orbit-accent/15 text-[10px] font-semibold text-orbit-accent">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-orbit-accent" />
                <span className="truncate text-sm font-medium">{source.fileName}</span>
                {source.similarity != null ? (
                  <Badge variant="muted" className="normal-case tracking-normal">
                    {Math.round(source.similarity * 100)}% match
                  </Badge>
                ) : null}
              </div>
              {source.path ? (
                <p className="mt-0.5 truncate text-[11px] text-orbit-foreground-muted">{source.path}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}
