'use client'

import { useState, useEffect } from 'react'
import { Employee, Schedule, ShiftTemplate } from '@/types'
import { storage } from '@/lib/storage'
import { generateWeeklySchedule, getDefaultShiftTemplates } from '@/lib/utils'
import { Plus, Calendar, Edit2, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import { showDangerConfirm } from '@/lib/sweetalert'

interface ScheduleManagerProps {
  employees: Employee[]
  onUpdate: () => void
  onScheduleSelect: (schedule: Schedule) => void
}

export default function ScheduleManager({ employees, onUpdate, onScheduleSelect }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    startDate: ''
  })

  useEffect(() => {
    const loadSchedules = async () => {
      const schedules = await storage.getSchedules()
      setSchedules(schedules)
    }
    loadSchedules()
  }, [])

  const handleCreate = () => {
    setIsCreating(true)
    const today = new Date()

    setFormData({
      name: `15-Day Schedule - ${today.toLocaleDateString()}`,
      startDate: today.toISOString().split('T')[0]
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.startDate) return

    const templates = getDefaultShiftTemplates()
    const schedule = generateWeeklySchedule(formData.startDate, formData.name.trim(), templates)

    await storage.addSchedule(schedule)
    const schedules = await storage.getSchedules()
    setSchedules(schedules)
    setIsCreating(false)
    setFormData({ name: '', startDate: '' })
    onUpdate()
  }

  const handleCancel = () => {
    setIsCreating(false)
    setFormData({ name: '', startDate: '' })
  }

  const handleDelete = async (id: string) => {
    const confirmed = await showDangerConfirm(
      'Esta acción no se puede deshacer.',
      '¿Eliminar horario?',
      'Sí, eliminar'
    )

    if (confirmed) {
      await storage.deleteSchedule(id)
      const schedules = await storage.getSchedules()
      setSchedules(schedules)
      onUpdate()
    }
  }

  const handleView = (schedule: Schedule) => {
    onScheduleSelect(schedule)
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-primary-600" />
            <div className="text-left">
              <h2 className="text-xl font-bold text-gray-900">Schedule Management</h2>
              <p className="text-sm text-gray-600">{schedules.length} schedules</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t p-6 space-y-6">
            <div className="flex items-center justify-end">
              <button
                onClick={handleCreate}
                className="btn btn-primary flex items-center space-x-2"
                disabled={isCreating}
              >
                <Plus className="h-5 w-5" />
                <span>Create Schedule</span>
              </button>
            </div>

            {employees.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="text-yellow-600">⚠️</div>
                  <div>
                    <h3 className="font-medium text-yellow-800">No employees added</h3>
                    <p className="text-yellow-700">You need to add employees before creating schedules.</p>
                  </div>
                </div>
              </div>
            )}

      {/* Create Form */}
      {isCreating && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Create New Schedule</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Enter schedule name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Default Schedule Template (15-Day Cycle)</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>24/7 Operation:</strong> 3 shifts per day, every day</p>
              <p><strong>Morning Shift:</strong> 6:00 AM - 2:00 PM</p>
              <p><strong>Afternoon Shift:</strong> 2:00 PM - 10:00 PM</p>
              <p><strong>Night Shift:</strong> 10:00 PM - 6:00 AM</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Schedule runs for 15 consecutive days. You can customize shifts after creating the schedule.
            </p>
          </div>

          <div className="flex items-center space-x-3 mt-6">
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={!formData.name.trim() || !formData.startDate}
            >
              Create Schedule
            </button>
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule) => {
          const totalShifts = schedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
          const assignedShifts = schedule.days.reduce(
            (sum, day) => sum + day.shifts.filter(shift => shift.isAssigned).length,
            0
          )

          return (
            <div key={schedule.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(schedule.startDate).toLocaleDateString()} - {new Date(schedule.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleView(schedule)}
                    className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                    title="View Schedule"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete Schedule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-medium">
                    {assignedShifts}/{totalShifts} shifts assigned
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0}%` }}
                  />
                </div>

                <div className="text-xs text-gray-500">
                  Created: {new Date(schedule.createdAt).toLocaleDateString()}
                </div>
              </div>

              <button
                onClick={() => handleView(schedule)}
                className="w-full mt-4 btn btn-secondary text-sm"
              >
                View & Edit Schedule
              </button>
            </div>
          )
        })}
      </div>

            {schedules.length === 0 && !isCreating && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
                <p className="text-gray-600 mb-4">Create your first schedule to start organizing work shifts.</p>
                <button
                  onClick={handleCreate}
                  className="btn btn-primary"
                  disabled={employees.length === 0}
                >
                  Create First Schedule
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}