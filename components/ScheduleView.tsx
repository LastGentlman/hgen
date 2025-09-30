'use client'

import { useState } from 'react'
import { Employee, Schedule, Shift } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime, calculateShiftDuration, exportToCSV, downloadFile } from '@/lib/utils'
import { User, Clock, Download, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface ScheduleViewProps {
  schedule: Schedule | null
  employees: Employee[]
  schedules: Schedule[]
  onScheduleSelect: (schedule: Schedule) => void
  onUpdate: () => void
}

export default function ScheduleView({ schedule, employees, schedules, onScheduleSelect, onUpdate }: ScheduleViewProps) {
  const [selectedScheduleId, setSelectedScheduleId] = useState(schedule?.id || '')
  const [assigningShift, setAssigningShift] = useState<{ dayIndex: number; shiftIndex: number } | null>(null)

  const employeeMap = new Map(employees.map(emp => [emp.id, emp]))

  const handleScheduleChange = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId)
    const selected = schedules.find(s => s.id === scheduleId)
    if (selected) {
      onScheduleSelect(selected)
    }
  }

  const handleAssignShift = (dayIndex: number, shiftIndex: number, employeeId: string) => {
    if (!schedule) return

    const updatedSchedule = { ...schedule }
    const shift = updatedSchedule.days[dayIndex].shifts[shiftIndex]

    if (employeeId === '') {
      // Unassign
      shift.employeeId = undefined
      shift.isAssigned = false
    } else {
      shift.employeeId = employeeId
      shift.isAssigned = true
    }

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
    setAssigningShift(null)
  }

  const getAvailableEmployees = (dayName: string, currentEmployeeId?: string) => {
    return employees.filter(emp =>
      emp.availableDays.includes(dayName) || emp.id === currentEmployeeId
    )
  }

  const exportToCSVFile = () => {
    if (!schedule) return
    const csv = exportToCSV(schedule, employees)
    downloadFile(csv, `${schedule.name}.csv`, 'text/csv')
  }

  const exportToHTML = () => {
    if (!schedule) return

    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${schedule.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .unassigned { background-color: #ffe6e6; }
        .day-header { background-color: #e3f2fd; font-weight: bold; }
        h1 { color: #1976d2; }
        .summary { background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>${schedule.name}</h1>
    <div class="summary">
        <p><strong>Period:</strong> ${new Date(schedule.startDate).toLocaleDateString()} - ${new Date(schedule.endDate).toLocaleDateString()}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <table>
        <tr>
            <th>Day</th>
            <th>Date</th>
            <th>Time</th>
            <th>Employee</th>
            <th>Duration</th>
        </tr>`

    schedule.days.forEach(day => {
      day.shifts.forEach((shift, index) => {
        const employee = shift.employeeId ? employeeMap.get(shift.employeeId) : null
        const employeeName = employee ? employee.name : 'UNASSIGNED'
        const duration = calculateShiftDuration(shift.startTime, shift.endTime)
        const cssClass = shift.isAssigned ? '' : 'unassigned'

        html += `
        <tr class="${cssClass}">
            <td>${index === 0 ? day.dayName : ''}</td>
            <td>${index === 0 ? day.date : ''}</td>
            <td>${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}</td>
            <td>${employeeName}</td>
            <td>${duration}h</td>
        </tr>`
      })
    })

    html += `
    </table>
</body>
</html>`

    downloadFile(html, `${schedule.name}.html`, 'text/html')
  }

  if (!schedule) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Schedule View</h2>

        {schedules.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules available</h3>
            <p className="text-gray-600">Create a schedule first to view it here.</p>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-lg font-medium mb-4">Select a Schedule</h3>
            <select
              value={selectedScheduleId}
              onChange={(e) => handleScheduleChange(e.target.value)}
              className="input"
            >
              <option value="">Choose a schedule...</option>
              {schedules.map(sch => (
                <option key={sch.id} value={sch.id}>
                  {sch.name} ({new Date(sch.startDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  const totalShifts = schedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
  const assignedShifts = schedule.days.reduce(
    (sum, day) => sum + day.shifts.filter(shift => shift.isAssigned).length,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{schedule.name}</h2>
          <p className="text-gray-600">
            {new Date(schedule.startDate).toLocaleDateString()} - {new Date(schedule.endDate).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right text-sm">
            <div className="font-medium">{assignedShifts}/{totalShifts} assigned</div>
            <div className="text-gray-500">
              {totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0}% complete
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportToCSVFile}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportToHTML}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>HTML</span>
            </button>
          </div>
        </div>
      </div>

      {schedules.length > 1 && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Switch Schedule
          </label>
          <select
            value={schedule.id}
            onChange={(e) => handleScheduleChange(e.target.value)}
            className="input max-w-md"
          >
            {schedules.map(sch => (
              <option key={sch.id} value={sch.id}>
                {sch.name} ({new Date(sch.startDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Assignment Progress</span>
          <span className="text-sm text-gray-600">{assignedShifts} of {totalShifts} shifts</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-primary-600 h-3 rounded-full transition-all"
            style={{ width: `${totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="space-y-4">
        {schedule.days.map((day, dayIndex) => (
          <div key={day.date} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{day.dayName}</h3>
                <p className="text-sm text-gray-600">{new Date(day.date).toLocaleDateString()}</p>
              </div>
              <div className="text-sm text-gray-600">
                {day.shifts.filter(s => s.isAssigned).length}/{day.shifts.length} assigned
              </div>
            </div>

            {day.shifts.length === 0 ? (
              <p className="text-gray-500 italic">No shifts scheduled</p>
            ) : (
              <div className="space-y-3">
                {day.shifts.map((shift, shiftIndex) => {
                  const employee = shift.employeeId ? employeeMap.get(shift.employeeId) : null
                  const duration = calculateShiftDuration(shift.startTime, shift.endTime)
                  const availableEmployees = getAvailableEmployees(day.dayName, shift.employeeId)

                  return (
                    <div
                      key={shift.id}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        shift.isAssigned
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </span>
                            <span className="text-sm text-gray-500">({duration}h)</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {employee ? (
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-700">{employee.name}</span>
                              {employee.department && (
                                <span className="text-sm text-gray-500">({employee.department})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-600 font-medium">UNASSIGNED</span>
                          )}

                          <select
                            value={shift.employeeId || ''}
                            onChange={(e) => handleAssignShift(dayIndex, shiftIndex, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Unassigned</option>
                            {availableEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.department ? `(${emp.department})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {availableEmployees.length === 0 && (
                        <div className="mt-2 text-sm text-yellow-600">
                          ⚠️ No employees available for {day.dayName}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}