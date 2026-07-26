import { useEffect, useRef, useState } from 'react'

import { Link } from 'react-router-dom'

import { Cpu, HardDrive, MemoryStick, Network } from 'lucide-react'



import { Sparkline } from '@/components/monitor/Sparkline'

import { Card } from '@/components/ui/Card'

import { Skeleton } from '@/components/ui/Skeleton'

import { routes } from '@/config/app'

import { useMonitoringStream } from '@/hooks/use-monitoring-stream'

import { formatBitrate } from '@/utils/format-bytes'



const MAX_POINTS = 24



function push(values: number[], next: number): number[] {

  return [...values, Number.isFinite(next) ? next : 0].slice(-MAX_POINTS)

}



export function ResourceWidgets() {

  const { data, isLoading } = useMonitoringStream()

  const [history, setHistory] = useState({

    cpu: [] as number[],

    ram: [] as number[],

    disk: [] as number[],

    netDown: [] as number[],

  })

  const seeded = useRef(false)



  useEffect(() => {

    if (!data) return

    setHistory((prev) => ({

      cpu: push(prev.cpu.length ? prev.cpu : data.cpu.loadHistory ?? [], data.cpu.usagePercent),

      ram: push(prev.ram, data.memory.usagePercent),

      disk: push(prev.disk, data.disk.usagePercent ?? 0),

      netDown: push(prev.netDown, data.network.downloadBytesPerSec),

    }))

    seeded.current = true

  }, [data])



  if (isLoading && !data) {

    return (

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {Array.from({ length: 4 }).map((_, i) => (

          <Card key={i}>

            <Skeleton className="h-4 w-16" />

            <Skeleton className="mt-4 h-8 w-20" />

            <Skeleton className="mt-4 h-12 w-full" />

          </Card>

        ))}

      </div>

    )

  }



  const widgets = [

    {

      icon: Cpu,

      label: 'CPU',

      value: `${data?.cpu.usagePercent ?? '—'}%`,

      spark: history.cpu,

      to: `${routes.intelligence}/cpu`,

    },

    {

      icon: MemoryStick,

      label: 'Memory',

      value: `${data?.memory.usagePercent ?? '—'}%`,

      spark: history.ram,

      to: `${routes.intelligence}/memory`,

    },

    {

      icon: HardDrive,

      label: 'Storage',

      value: `${data?.disk.usagePercent ?? '—'}%`,

      spark: history.disk,

      to: `${routes.intelligence}/storage`,

    },

    {

      icon: Network,

      label: 'Network',

      value: formatBitrate(data?.network.downloadBytesPerSec ?? 0),

      spark: history.netDown,

      to: `${routes.intelligence}/network`,

    },

  ]



  return (

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {widgets.map((widget) => (

        <Link key={widget.label} to={widget.to} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-orbit-accent">

          <Card className="transition-shadow hover:shadow-md">

            <div className="flex items-center justify-between gap-2">

              <div className="flex items-center gap-2">

                <widget.icon className="h-4 w-4 text-orbit-accent" />

                <span className="text-sm font-semibold">{widget.label}</span>

              </div>

              <span className="text-lg font-semibold tabular-nums">{widget.value}</span>

            </div>

            <Sparkline values={widget.spark} className="mt-4" />

          </Card>

        </Link>

      ))}

    </div>

  )

}


