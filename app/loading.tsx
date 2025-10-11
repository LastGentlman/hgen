export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-primary-600 rounded-full mx-auto mb-3" />
        <p className="text-gray-600">Cargando…</p>
      </div>
    </div>
  )
}
