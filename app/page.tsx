'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Employee, Schedule, BranchCode, Division } from '@/types'
import { storage } from '@/lib/storage'
import { Calendar, Users, Grid3x3, History, Menu } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import SyncIndicator from '@/components/SyncIndicator'

// Lazy load tab components for better performance
const EmployeeManager = dynamic(() => import('@/components/EmployeeManager'), {
  loading: () => <div className="flex items-center justify-center py-12"><div className="animate-pulse text-gray-500">Cargando...</div></div>,
  ssr: false
})

const HistoryManager = dynamic(() => import('@/components/HistoryManager'), {
  loading: () => <div className="flex items-center justify-center py-12"><div className="animate-pulse text-gray-500">Cargando...</div></div>,
  ssr: false
})

const GridView = dynamic(() => import('@/components/GridView'), {
  loading: () => <div className="flex items-center justify-center py-12"><div className="animate-pulse text-gray-500">Cargando...</div></div>,
  ssr: false
})

type ActiveTab = 'employees' | 'history' | 'grid'

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('grid')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null)
  const [branchCode, setBranchCode] = useState<BranchCode>('001')
  const [division, setDivision] = useState<Division>('super')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const loadedEmployees = await storage.getEmployees()
      const loadedSchedules = await storage.getSchedules()

      setEmployees(loadedEmployees)
      setSchedules(loadedSchedules)

      // Auto-select the most current schedule (closest to today) if any exist
      if (loadedSchedules.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Filter by context
        const contextSchedules = loadedSchedules.filter(s =>
          (!s.branchCode || s.branchCode === branchCode) && (!s.division || s.division === division)
        )

        if (contextSchedules.length === 0) {
          setActiveSchedule(null)
          return
        }

        const sortedSchedules = [...contextSchedules].sort((a, b) => {
          const [aYear, aMonth, aDay] = a.startDate.split('-').map(Number)
          const aStart = new Date(aYear, aMonth - 1, aDay).getTime()
          const [bYear, bMonth, bDay] = b.startDate.split('-').map(Number)
          const bStart = new Date(bYear, bMonth - 1, bDay).getTime()
          const todayTime = today.getTime()

          // Prefer schedules that include today
          const [aEYear, aEMonth, aEDay] = a.endDate.split('-').map(Number)
          const aEnd = new Date(aEYear, aEMonth - 1, aEDay).getTime()
          const [bEYear, bEMonth, bEDay] = b.endDate.split('-').map(Number)
          const bEnd = new Date(bEYear, bEMonth - 1, bEDay).getTime()

          const aIncludes = aStart <= todayTime && aEnd >= todayTime
          const bIncludes = bStart <= todayTime && bEnd >= todayTime

          if (aIncludes && !bIncludes) return -1
          if (!aIncludes && bIncludes) return 1

          // Otherwise sort by most recent
          return bStart - aStart
        })
        setActiveSchedule(sortedSchedules[0])
      } else {
        setActiveSchedule(null)
      }
    }

    loadData()
  }, [])

  // When context changes, select appropriate schedule if exists
  useEffect(() => {
    const updateContext = async () => {
      const allSchedules = await storage.getSchedules()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const contextSchedules = allSchedules.filter(s =>
        (!s.branchCode || s.branchCode === branchCode) && (!s.division || s.division === division)
      )

      if (contextSchedules.length === 0) {
        setActiveSchedule(null)
        return
      }

      // Pick the one that includes today if possible, else most recent
      const sorted = [...contextSchedules].sort((a, b) => {
        const aStart = new Date(a.startDate).getTime()
        const bStart = new Date(b.startDate).getTime()
        const aEnd = new Date(a.endDate).getTime()
        const bEnd = new Date(b.endDate).getTime()
        const todayTime = today.getTime()
        const aIncludes = aStart <= todayTime && aEnd >= todayTime
        const bIncludes = bStart <= todayTime && bEnd >= todayTime
        if (aIncludes && !bIncludes) return -1
        if (!aIncludes && bIncludes) return 1
        return bStart - aStart
      })
      setActiveSchedule(sorted[0])
    }

    updateContext()
  }, [branchCode, division])

  const handleEmployeeUpdate = async () => {
    const employees = await storage.getEmployees()
    setEmployees(employees)
  }

  const handleScheduleUpdate = async () => {
    const updatedSchedules = await storage.getSchedules()
    setSchedules(updatedSchedules)

    // Also refresh employees in case shift assignments changed
    const employees = await storage.getEmployees()
    setEmployees(employees)

    // Update active schedule if it was modified
    if (activeSchedule) {
      const updated = updatedSchedules.find(s => s.id === activeSchedule.id)
      if (updated) {
        setActiveSchedule(updated)
      }
    }
  }

  const tabs = [
    { id: 'employees' as const, label: 'Empleados', icon: Users },
    { id: 'history' as const, label: 'Historial', icon: History },
    { id: 'grid' as const, label: 'Cuadrícula', icon: Grid3x3 }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-8 w-8 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">HGen</h1>
              </div>
              <span className="text-sm text-gray-500">Generador de Horarios de Trabajo</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Context selectors driving the main flow (only show when relevant) */}
              {(activeTab !== 'employees' || employees.length > 0 || schedules.length > 0) && (
                <div className="hidden md:flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Sucursal</label>
                  <select
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value as BranchCode)}
                    className="input h-8 py-0 text-sm"
                  >
                    {(['001','002','003'] as BranchCode[]).map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <label className="text-sm text-gray-600">División</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as Division)}
                    className="input h-8 py-0 text-sm"
                  >
                    {(['super','gasolinera','restaurant','limpieza'] as Division[])
                      .filter(d => !(d === 'restaurant' && branchCode === '002'))
                      .map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Summary */}
              {schedules.length > 0 && (
                <span className="text-sm text-gray-600 hidden md:inline">
                  {employees.length} empleados • {schedules.length} horarios
                </span>
              )}

              {/* Hamburger for secondary actions */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded hover:bg-gray-100"
                aria-label="Abrir menú"
              >
                <Menu className="h-6 w-6 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              activeTab === 'employees'
                ? { label: 'Empleados' }
                : activeTab === 'history'
                ? { label: 'Historial' }
                : { label: 'Cuadrícula' }
            ]}
          />
        </div>
      </div>

      {/* Mobile hamburger menu content */}
      {isMenuOpen && (
        <div className="md:hidden border-b bg-white">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Sucursal</label>
              <select
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value as BranchCode)}
                className="input h-8 py-0 text-sm"
              >
                {(['001','002','003'] as BranchCode[]).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">División</label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as Division)}
                className="input h-8 py-0 text-sm"
              >
                {(['super','gasolinera','restaurant','limpieza'] as Division[])
                  .filter(d => !(d === 'restaurant' && branchCode === '002'))
                  .map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
              </select>
            </div>

            {/* Navigation items */}
            <div className="pt-3 border-t">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setActiveTab('employees'); setIsMenuOpen(false) }}
                  className={`flex items-center justify-center space-x-1 py-2 rounded border text-sm ${
                    activeTab === 'employees' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Empleados</span>
                </button>
                <button
                  onClick={() => { setActiveTab('history'); setIsMenuOpen(false) }}
                  className={`flex items-center justify-center space-x-1 py-2 rounded border text-sm ${
                    activeTab === 'history' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>Historial</span>
                </button>
                <button
                  onClick={() => { setActiveTab('grid'); setIsMenuOpen(false) }}
                  className={`flex items-center justify-center space-x-1 py-2 rounded border text-sm ${
                    activeTab === 'grid' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" />
                  <span>Cuadrícula</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-b hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'employees' && (
          <EmployeeManager onUpdate={handleEmployeeUpdate} branchCode={branchCode} division={division} />
        )}

        {activeTab === 'history' && (
          <HistoryManager
            onScheduleSelect={setActiveSchedule}
            activeScheduleId={activeSchedule?.id || null}
            branchCode={branchCode}
            division={division}
            onUpdate={handleScheduleUpdate}
          />
        )}

        {activeTab === 'grid' && (
          <GridView
            schedule={activeSchedule}
            employees={employees.filter(emp =>
              emp.branchCode === branchCode && emp.division === division
            )}
            onUpdate={handleScheduleUpdate}
            branchCode={branchCode}
            division={division}
          />
        )}
      </main>

      {/* Sync Indicator - shows online/offline status and pending operations */}
      <SyncIndicator />
    </div>
  )
}