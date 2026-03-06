export type ToastType = 'success' | 'error' | 'info'

export type ToastMessage = {
  type: ToastType
  message: string
}

export type TaskMutation =
  | { action: 'add'; task: any }
  | { action: 'replace'; tempId: string; task: any }
  | { action: 'remove'; taskId: string }

const TOAST_EVENT = 'app:toast'
const TASK_MUTATION_EVENT = 'app:task-mutation'

export function emitToast(toast: ToastMessage) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: toast }))
}

export function subscribeToasts(handler: (toast: ToastMessage) => void) {
  if (typeof window === 'undefined') return () => {}
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ToastMessage>
    handler(customEvent.detail)
  }
  window.addEventListener(TOAST_EVENT, listener)
  return () => window.removeEventListener(TOAST_EVENT, listener)
}

export function emitTaskMutation(mutation: TaskMutation) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TASK_MUTATION_EVENT, { detail: mutation }))
}

export function subscribeTaskMutations(handler: (mutation: TaskMutation) => void) {
  if (typeof window === 'undefined') return () => {}
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<TaskMutation>
    handler(customEvent.detail)
  }
  window.addEventListener(TASK_MUTATION_EVENT, listener)
  return () => window.removeEventListener(TASK_MUTATION_EVENT, listener)
}
