import { cn } from '@/utils/cn'

export type SettingsSection =
  | 'general'
  | 'indexing'
  | 'ai'
  | 'notifications'
  | 'maintenance'

const sections: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'indexing', label: 'Indexing' },
  { id: 'ai', label: 'AI Models' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'maintenance', label: 'Maintenance' },
]

interface SettingsTabsProps {
  active: SettingsSection
  onChange: (section: SettingsSection) => void
}

export function SettingsTabs({ active, onChange }: SettingsTabsProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-orbit-border/70 pb-4">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
            active === section.id
              ? 'bg-orbit-accent/15 text-orbit-accent shadow-sm'
              : 'text-orbit-foreground-muted hover:bg-orbit-muted/60 hover:text-orbit-foreground',
          )}
        >
          {section.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsSection({
  id,
  active,
  children,
}: {
  id: SettingsSection
  active: SettingsSection
  children: React.ReactNode
}) {
  if (id !== active) return null
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}
