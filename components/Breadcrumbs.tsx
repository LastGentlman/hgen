'use client'

import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="text-sm text-gray-600" aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-gray-800 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-800 font-medium">{item.label}</span>
              )}
              {!isLast && <span className="mx-2 text-gray-400">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
