import {
  Bot,
  Brain,
  Database,
  FileSearch,
  Layers,
  Lock,
  Server,
  Sparkles,
  Workflow,
} from 'lucide-react'

import { OrbitLogo } from '@/components/brand/OrbitLogo'
import { Card } from '@/components/ui/Card'
import { appConfig } from '@/config/app'

const features = [
  { icon: Bot, title: 'AI Copilot', description: 'Natural language control of your desktop and workflows.' },
  {
    icon: FileSearch,
    title: 'Semantic Search',
    description: 'Find documents by meaning, not just keywords — powered by local embeddings.',
  },
  {
    icon: Brain,
    title: 'Document Intelligence',
    description: 'Index, chunk, and understand files on your machine with full privacy.',
  },
  {
    icon: Workflow,
    title: 'Desktop Automation',
    description: 'Automate repetitive tasks with auditable execution history.',
  },
  {
    icon: Sparkles,
    title: 'Analytics',
    description: 'Historical metrics and intelligence reports across your workspace.',
  },
  {
    icon: Lock,
    title: 'Privacy-first Local AI',
    description: 'Your data stays on your device — SQLite, ChromaDB, and local models.',
  },
] as const

const stack = [
  {
    title: 'Frontend',
    items: ['React', 'TypeScript', 'Tailwind CSS'],
  },
  { title: 'Desktop', items: ['Electron'] },
  { title: 'Backend', items: ['FastAPI'] },
  { title: 'Database', items: ['SQLite'] },
  { title: 'Vector Database', items: ['ChromaDB'] },
  {
    title: 'AI',
    items: ['Sentence Transformers', 'Ollama support', 'Local embeddings'],
  },
] as const

export function AboutPage() {
  return (
    <div className="animate-fade-in">
      <Card padding="lg" className="mb-8 overflow-hidden border-orbit-accent/15 bg-gradient-to-b from-orbit-surface to-orbit-surface-elevated">
        <div className="flex flex-col items-center text-center">
          <OrbitLogo size="hero" className="drop-shadow-[0_8px_32px_rgba(139,92,246,0.25)]" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            Orbit Desktop Intelligence
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-orbit-foreground-muted sm:text-base">
            {appConfig.tagline}. Orbit brings AI-native search, document understanding, and automation
            to your desktop — fast, private, and always under your control.
          </p>
        </div>
      </Card>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">Mission</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-orbit-foreground-muted">
            Make every file on your computer searchable, understandable, and actionable through local
            intelligence — without sending your data to the cloud.
          </p>
        </Card>
        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">Vision</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-orbit-foreground-muted">
            A premium AI desktop operating layer that feels as refined as Linear or Raycast — built for
            professionals who demand speed, privacy, and clarity.
          </p>
        </Card>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-semibold tracking-tight">Core features</h2>
        <p className="mt-2 max-w-2xl text-sm text-orbit-foreground-muted">
          Capabilities shipping across Orbit — some modules expand in upcoming releases.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="transition-all duration-200 hover:border-orbit-accent/25 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orbit-accent/10 text-orbit-accent">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-orbit-foreground-muted">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold tracking-tight">Technology stack</h2>
        <p className="mt-2 max-w-2xl text-sm text-orbit-foreground-muted">
          Built with modern, proven tools for reliability.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stack.map((group) => (
          <Card key={group.title}>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-orbit-foreground-muted" />
              <h3 className="text-sm font-semibold">{group.title}</h3>
            </div>
            <ul className="mt-3 space-y-1.5">
              {group.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-orbit-foreground-muted">
                  <Database className="h-3 w-3 shrink-0 opacity-50" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        </div>
      </section>

      <footer className="rounded-xl border border-orbit-border bg-orbit-muted/30 px-6 py-8 text-center">
        <p className="text-sm text-orbit-foreground-muted">
          Version <span className="font-medium text-orbit-foreground">{appConfig.version}</span>
          {' · '}
          Build <span className="font-medium text-orbit-foreground">{appConfig.version}</span>
          {' · '}
          {appConfig.license}
        </p>
        <p className="mt-3 text-sm text-orbit-foreground-muted">Designed with ❤ for desktop intelligence</p>
      </footer>
    </div>
  )
}
