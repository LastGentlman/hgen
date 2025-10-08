import { Employee, Schedule } from '@/types'

const QUEUE_KEY = 'hgen_sync_queue'
const MAX_RETRIES = 3

/**
 * Tipos de operaciones que pueden ponerse en cola
 */
export type PendingOperation =
  | { type: 'add_employee'; data: Employee }
  | { type: 'update_employee'; id: string; data: Partial<Employee> }
  | { type: 'delete_employee'; id: string }
  | { type: 'add_schedule'; data: Schedule }
  | { type: 'update_schedule'; id: string; data: Partial<Schedule> }
  | { type: 'delete_schedule'; id: string }

export interface QueuedOperation {
  id: string
  operation: PendingOperation
  timestamp: number
  retries: number
}

/**
 * Sistema de cola para operaciones pendientes
 */
class SyncQueue {
  /**
   * Obtiene todas las operaciones pendientes
   */
  getAll(): QueuedOperation[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(QUEUE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading sync queue:', error)
      return []
    }
  }

  /**
   * Guarda la cola actualizada
   */
  private save(queue: QueuedOperation[]): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    } catch (error) {
      console.error('Error saving sync queue:', error)
    }
  }

  /**
   * Agrega una operación a la cola
   */
  enqueue(operation: PendingOperation): void {
    const queue = this.getAll()

    const queuedOp: QueuedOperation = {
      id: `${operation.type}_${Date.now()}_${Math.random()}`,
      operation,
      timestamp: Date.now(),
      retries: 0
    }

    queue.push(queuedOp)
    this.save(queue)

    console.log(`📝 Operación agregada a cola: ${operation.type}`, queuedOp.id)
  }

  /**
   * Elimina una operación de la cola
   */
  dequeue(operationId: string): void {
    const queue = this.getAll()
    const filtered = queue.filter(op => op.id !== operationId)
    this.save(filtered)
  }

  /**
   * Incrementa el contador de reintentos de una operación
   */
  incrementRetry(operationId: string): void {
    const queue = this.getAll()
    const updated = queue.map(op => {
      if (op.id === operationId) {
        return { ...op, retries: op.retries + 1 }
      }
      return op
    })
    this.save(updated)
  }

  /**
   * Elimina operaciones que superaron el máximo de reintentos
   */
  cleanupFailed(): void {
    const queue = this.getAll()
    const cleaned = queue.filter(op => op.retries < MAX_RETRIES)

    const removed = queue.length - cleaned.length
    if (removed > 0) {
      console.warn(`🗑️ ${removed} operaciones eliminadas por exceder reintentos`)
      this.save(cleaned)
    }
  }

  /**
   * Limpia toda la cola
   */
  clear(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(QUEUE_KEY)
    console.log('🧹 Cola de sincronización limpiada')
  }

  /**
   * Obtiene el tamaño de la cola
   */
  size(): number {
    return this.getAll().length
  }

  /**
   * Verifica si hay operaciones pendientes
   */
  isEmpty(): boolean {
    return this.size() === 0
  }
}

// Singleton
export const syncQueue = new SyncQueue()

/**
 * Estado de sincronización para la UI
 */
export type SyncStatus =
  | 'idle'       // Sin operaciones pendientes
  | 'syncing'    // Sincronizando
  | 'error'      // Error en sincronización
  | 'offline'    // Sin conexión con operaciones pendientes

let syncStatusListeners: Array<(status: SyncStatus) => void> = []

/**
 * Suscribirse a cambios en el estado de sincronización
 */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  syncStatusListeners.push(listener)

  return () => {
    syncStatusListeners = syncStatusListeners.filter(l => l !== listener)
  }
}

/**
 * Notificar cambio de estado
 */
export function notifySyncStatus(status: SyncStatus) {
  syncStatusListeners.forEach(listener => listener(status))
}
