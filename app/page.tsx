'use client'

import { useState, useEffect } from 'react'
import { Employee, Schedule } from '@/types'
import { storage } from '@/lib/storage'
import EmployeeManager from '@/components/EmployeeManager'
import HistoryManager from '@/components/HistoryManager'
import GridView from '@/components/GridView'
import { Calendar, Users, Grid3x3, History } from 'lucide-react'

type ActiveTab = 'employees' | 'history' | 'grid'

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('grid')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null)

  useEffect(() => {
    const loadedEmployees = storage.getEmployees()
    let loadedSchedules = storage.getSchedules()

    setEmployees(loadedEmployees)

    // Auto-create schedules if none exist OR if existing schedules are outdated
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to midnight for comparison

    const hasCurrentSchedule = loadedSchedules.some(schedule => {
      const [year, month, day] = schedule.startDate.split('-').map(Number)
      const scheduleStart = new Date(year, month - 1, day)
      const [eYear, eMonth, eDay] = schedule.endDate.split('-').map(Number)
      const scheduleEnd = new Date(eYear, eMonth - 1, eDay)
      scheduleStart.setHours(0, 0, 0, 0)
      scheduleEnd.setHours(0, 0, 0, 0)

      return today >= scheduleStart && today <= scheduleEnd
    })

    if (!hasCurrentSchedule) {
      const currentDay = today.getDate()

      // Determine which schedule to create based on current date
      let startDate: Date
      let scheduleName: string

      if (currentDay <= 15) {
        // Create first half schedule (1st to 15th)
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        scheduleName = `Horario ${today.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 1ra Quincena`
      } else {
        // Create second half schedule (16th to end of month)
        startDate = new Date(today.getFullYear(), today.getMonth(), 16)
        scheduleName = `Horario ${today.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 2da Quincena`
      }

      const { generateWeeklySchedule, getDefaultShiftTemplates } = require('@/lib/utils')
      const templates = getDefaultShiftTemplates()
      const newSchedule = generateWeeklySchedule(
        startDate.toISOString().split('T')[0],
        scheduleName,
        templates
      )

      storage.addSchedule(newSchedule)
      loadedSchedules = storage.getSchedules()
    }

    setSchedules(loadedSchedules)

    // Auto-select the most current schedule (closest to today)
    if (loadedSchedules.length > 0) {
      const sortedSchedules = [...loadedSchedules].sort((a, b) => {
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
    }
  }, [])

  const handleEmployeeUpdate = () => {
    setEmployees(storage.getEmployees())
  }

  const handleScheduleUpdate = () => {
    const updatedSchedules = storage.getSchedules()
    setSchedules(updatedSchedules)

    // Also refresh employees in case shift assignments changed
    setEmployees(storage.getEmployees())

    // Update active schedule if it was modified
    if (activeSchedule) {
      const updated = updatedSchedules.find(s => s.id === activeSchedule.id)
      if (updated) {
        setActiveSchedule(updated)
      }
    }
  }

  const tabs = [
    { id: 'employees' as const, label: 'Employees', icon: Users },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'grid' as const, label: 'Schedule Grid', icon: Grid3x3 }
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
              <span className="text-sm text-gray-500">Work Schedule Generator</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {employees.length} employees • {schedules.length} schedules
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
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
          <EmployeeManager onUpdate={handleEmployeeUpdate} />
        )}

        {activeTab === 'history' && (
          <HistoryManager
            onScheduleSelect={setActiveSchedule}
            activeScheduleId={activeSchedule?.id || null}
          />
        )}

        {activeTab === 'grid' && (
          <GridView
            schedule={activeSchedule}
            employees={employees}
            onUpdate={handleScheduleUpdate}
          />
        )}
      </main>
    </div>
  )
}