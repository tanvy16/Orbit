import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

interface IntelligenceDetailLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export function IntelligenceDetailLayout({ title, description, children }: IntelligenceDetailLayoutProps) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link to="/intelligence">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              System Intelligence
            </Button>
          </Link>
        }
      />
      {children}
    </>
  )
}
