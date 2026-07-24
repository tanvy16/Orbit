import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { motion } from 'framer-motion'

import { cn } from '@/utils/cn'

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+)/g)
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-orbit-muted px-1.5 py-0.5 font-mono text-[0.85em] text-orbit-accent"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-orbit-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={index} className="italic text-orbit-foreground-muted">
          {part.slice(1, -1)}
        </em>
      )
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-orbit-accent underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

function CodeBlock({ code }: { code: string }) {
  const lines = code.trim().split('\n')
  const firstLine = lines[0]?.trim() ?? ''
  const hasLanguage = /^[a-z0-9+#.-]{1,20}$/i.test(firstLine) && !firstLine.includes(' ')
  const language = hasLanguage ? firstLine : null
  const body = hasLanguage ? lines.slice(1).join('\n').trim() : code.trim()

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-orbit-border/80 bg-orbit-background/90">
      {language ? (
        <div className="border-b border-orbit-border/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-orbit-foreground-muted">
          {language}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-orbit-foreground">
        <code>{body}</code>
      </pre>
    </div>
  )
}

function renderTextBlock(block: string, blockIndex: number) {
  const elements: ReactNode[] = []

  block.split('\n').forEach((line, lineIndex) => {
    const trimmed = line.trim()
    const key = `${blockIndex}-${lineIndex}`

    if (!trimmed) {
      elements.push(<div key={key} className="h-2.5" />)
      return
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 1
      const text = trimmed.replace(/^#+\s*/, '')
      const className =
        level === 1
          ? 'text-base font-semibold'
          : level === 2
            ? 'text-sm font-semibold'
            : 'text-sm font-medium text-orbit-foreground-muted'
      elements.push(
        <p key={key} className={cn(className, 'mt-1 first:mt-0')}>
          {renderInline(text)}
        </p>,
      )
      return
    }

    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={key}
          className="border-l-2 border-orbit-accent/50 pl-3 text-orbit-foreground-muted italic"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>,
      )
      return
    }

    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <p key={key} className="pl-1">
          {trimmed.match(/^\d+/)?.[0]}. {renderInline(trimmed.replace(/^\d+\.\s*/, ''))}
        </p>,
      )
      return
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <p key={key} className="flex gap-2 pl-1">
          <span className="text-orbit-accent">•</span>
          <span className="min-w-0 flex-1">{renderInline(trimmed.slice(2))}</span>
        </p>,
      )
      return
    }

    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={key} className="my-3 border-orbit-border/70" />)
      return
    }

    elements.push(
      <p key={key} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    )
  })

  return elements
}

interface CopilotMarkdownProps {
  content: string
  className?: string
  streaming?: boolean
}

export function CopilotMarkdown({ content, className, streaming = false }: CopilotMarkdownProps) {
  const blocks = useMemo(() => content.split(/```/g), [content])

  return (
    <div className={cn('space-y-1.5 text-sm text-orbit-foreground', className)}>
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          return <CodeBlock key={index} code={block} />
        }
        return <div key={index}>{renderTextBlock(block, index)}</div>
      })}
      {streaming ? (
        <motion.span
          className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 rounded-full bg-orbit-accent"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
