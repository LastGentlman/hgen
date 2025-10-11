/**
 * SweetAlert2 Helper - Alertas bonitas y consistentes
 * Todas las funciones retornan Promises para uso con async/await
 */

let cachedSwal: any | null = null
const loadSwal = async () => {
  if (cachedSwal) return cachedSwal
  const mod = await import('sweetalert2')
  cachedSwal = mod.default
  return cachedSwal
}

// Configuración base para todas las alertas
const baseConfig = {
  confirmButtonColor: '#2563eb', // primary-600
  cancelButtonColor: '#6b7280',  // gray-500
  confirmButtonText: 'Aceptar',
  cancelButtonText: 'Cancelar',
}

/**
 * Muestra un mensaje de éxito
 */
export const showSuccess = async (message: string, title: string = '¡Éxito!') => {
  const Swal = await loadSwal()
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: baseConfig.confirmButtonColor,
  })
}

/**
 * Muestra un mensaje de error
 */
export const showError = async (message: string, title: string = 'Error') => {
  const Swal = await loadSwal()
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: baseConfig.confirmButtonColor,
  })
}

/**
 * Muestra un mensaje de advertencia
 */
export const showWarning = async (message: string, title: string = 'Advertencia') => {
  const Swal = await loadSwal()
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: baseConfig.confirmButtonColor,
  })
}

/**
 * Muestra un mensaje informativo
 */
export const showInfo = async (message: string, title: string = 'Información') => {
  const Swal = await loadSwal()
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: baseConfig.confirmButtonColor,
  })
}

/**
 * Muestra un diálogo de confirmación
 * Retorna true si el usuario confirma, false si cancela
 */
export const showConfirm = async (
  message: string,
  title: string = '¿Estás seguro?',
  confirmText: string = 'Sí, continuar',
  cancelText: string = 'Cancelar'
): Promise<boolean> => {
  const Swal = await loadSwal()
  const result = await Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: baseConfig.confirmButtonColor,
    cancelButtonColor: baseConfig.cancelButtonColor,
    reverseButtons: true, // Cancelar a la izquierda, Confirmar a la derecha
  })

  return result.isConfirmed
}

/**
 * Muestra un diálogo de confirmación peligrosa (para acciones destructivas)
 * Usa color rojo para el botón de confirmación
 */
export const showDangerConfirm = async (
  message: string,
  title: string = '⚠️ Acción peligrosa',
  confirmText: string = 'Sí, eliminar',
  cancelText: string = 'Cancelar'
): Promise<boolean> => {
  const Swal = await loadSwal()
  const result = await Swal.fire({
    icon: 'warning',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: '#dc2626', // red-600
    cancelButtonColor: baseConfig.cancelButtonColor,
    reverseButtons: true,
  })

  return result.isConfirmed
}

/**
 * Muestra un toast (notificación pequeña en la esquina)
 * Útil para confirmaciones rápidas que no interrumpen el flujo
 */
export const showToast = async (message: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  const Swal = await loadSwal()
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
  })
}

/**
 * Muestra un loading (spinner) mientras se ejecuta una operación
 * Útil para operaciones asíncronas
 */
export const showLoading = async (title: string = 'Procesando...', text?: string) => {
  const Swal = await loadSwal()
  Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading()
    }
  })
}

/**
 * Cierra cualquier alerta activa
 */
export const closeAlert = () => {
  // Cierra si ya se cargó; evita importar sólo para cerrar
  if (cachedSwal) {
    cachedSwal.close()
  }
}

/**
 * Muestra un mensaje de advertencia con HTML personalizado
 * Útil para mensajes con listas o formato especial
 */
export const showWarningHtml = async (htmlContent: string, title: string = 'Advertencia') => {
  const Swal = await loadSwal()
  return Swal.fire({
    icon: 'warning',
    title,
    html: htmlContent,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: baseConfig.confirmButtonColor,
  })
}
