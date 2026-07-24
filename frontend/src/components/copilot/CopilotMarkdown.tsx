import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-orbit-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-lg bg-orbit-background/80 p-3 font-mono text-xs leading-relaxed">
      <code>{code}</code>
    </pre>
  )
}

export function CopilotMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = content.split(/```/g)

  return (
    <div className={cn('space-y-2 text-sm leading-relaxed', className)}>
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          return <CodeBlock key={index} code={block.trim()} />
        }
        return block.split('\n').map((line, lineIndex) => {
          const trimmed = line.trim()
          if (!trimmed) {
            return <div key={`${index}-${lineIndex}`} className="h-2" />
          }
          if (trimmed.startsWith('- ')) {
            return (
              <p key={`${index}-${lineIndex}`} className="pl-1">
                • {renderInline(trimmed.slice(2))}
              </p>
            )
          }
          return (
            <p key={`${index}-${lineIndex}`}>{renderInline(line)}</p>
          )
        })
      })}
    </div>
  )
}
