'use client'

import { useState, useEffect } from 'react'
import { Employee, Schedule } from '@/types'
import { storage } from '@/lib/storage'
import EmployeeManager from '@/components/EmployeeManager'
import ScheduleManager from '@/components/ScheduleManager'
import GridView from '@/components/GridView'
import { Calendar, Users, Grid3x3 } from 'lucide-react'

type ActiveTab = 'employees' | 'schedules' | 'grid'

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('grid')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null)

  useEffect(() => {
    const loadedEmployees = storage.getEmployees()
    const loadedSchedules = storage.getSchedules()

    setEmployees(loadedEmployees)
    setSchedules(loadedSchedules)

    // Auto-select the last created schedule
    if (loadedSchedules.length > 0) {
      // Sort by createdAt descending to get the most recent
      const sortedSchedules = [...loadedSchedules].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setActiveSchedule(sortedSchedules[0])
    }
  }, [])

  const handleEmployeeUpdate = () => {
    setEmployees(storage.getEmployees())
  }

  const handleScheduleUpdate = () => {
    const updatedSchedules = storage.getSchedules()
    setSchedules(updatedSchedules)

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
    { id: 'schedules' as const, label: 'Schedules', icon: Calendar },
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

        {activeTab === 'schedules' && (
          <ScheduleManager
            employees={employees}
            onUpdate={handleScheduleUpdate}
            onScheduleSelect={setActiveSchedule}
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