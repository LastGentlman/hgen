"use client"

import React, { useEffect, useMemo } from 'react'

export interface VideoModalProps {
  open: boolean
  onClose: () => void
  /**
   * Direct video URL (mp4, webm, m3u8) OR any http(s) URL.
   * If it's a Google Drive link, the component will auto-detect and use the Drive preview embed.
   */
  src?: string
  /**
   * Optional Google Drive file ID if you have it directly.
   * When provided, Drive preview embed will be used.
   */
  driveFileId?: string
  /** Optional title shown in the header */
  title?: string
  /** Start playback automatically when opened (HTML5 video only) */
  autoPlay?: boolean
}

function extractDriveFileId(input?: string | null): string | null {
  if (!input) return null
  try {
    // If input already looks like a bare file id (no slashes and length ~> 20), accept it
    if (!/\//.test(input) && input.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(input)) {
      return input
    }

    const url = new URL(input)
    if (!/drive\.google\.com$/.test(url.hostname)) return null

    // Patterns:
    // 1) /file/d/FILE_ID/...
    const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch?.[1]) return fileMatch[1]

    // 2) open?id=FILE_ID or uc?id=FILE_ID
    const idParam = url.searchParams.get('id')
    if (idParam) return idParam

    return null
  } catch {
    return null
  }
}

function getDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`
}

function isHls(src?: string): boolean {
  return !!src && /\.m3u8($|\?)/i.test(src)
}

export default function VideoModal({ open, onClose, src, driveFileId, title = 'Video', autoPlay = false }: VideoModalProps) {
  const detectedDriveId = useMemo(() => {
    if (driveFileId) return driveFileId
    const maybeId = extractDriveFileId(src || null)
    return maybeId
  }, [driveFileId, src])

  const driveEmbedUrl = useMemo(() => {
    return detectedDriveId ? getDrivePreviewUrl(detectedDriveId) : null
  }, [detectedDriveId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const useHtml5Player = !driveEmbedUrl && !!src

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h3>
          <button aria-label="Cerrar" onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="bg-black">
          {/* 16:9 responsive container */}
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            {driveEmbedUrl ? (
              <iframe
                src={driveEmbedUrl}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : useHtml5Player ? (
              <video
                className="absolute inset-0 w-full h-full"
                src={src}
                controls
                playsInline
                autoPlay={autoPlay}
                preload="metadata"
                // Note: HLS streaming on Safari works natively; other browsers may need hls.js (not included here)
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                No se pudo cargar el video.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50">Cerrar</button>
        </div>
      </div>

      {/* Backdrop click to close */}
      <button aria-hidden className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  )
}
