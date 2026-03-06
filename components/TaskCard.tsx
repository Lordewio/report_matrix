import React from 'react'
import Link from 'next/link'

export default function TaskCard({ task, actions }: { task: any; actions?: React.ReactNode }) {
  return (
    <article className="ucc-card p-4 mb-3">
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">
            <Link href={`/tasks/${task.id}`} className="ucc-link">{task.title}</Link>
          </h3>
          {task.optimistic && <span className="text-xs rounded bg-amber-100 text-amber-700 px-2 py-0.5">Syncing...</span>}
        </div>
        <span className="text-sm ucc-muted">{new Date(task.created_at).toLocaleDateString()}</span>
      </div>
      <div className="text-sm mt-2">{task.description}</div>
      <div className="text-xs ucc-muted mt-2">{task.reporting_area} — {task.author_name}</div>
      <div className="mt-2">
        <Link href={`/tasks/${task.id}`} className="ucc-link text-sm">View details</Link>
      </div>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </article>
  )
}
