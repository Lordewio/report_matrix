import React from 'react'
import TaskForm from '../../../components/TaskForm'

export default function NewTaskPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Log Task</h1>
      <TaskForm />
    </section>
  )
}
