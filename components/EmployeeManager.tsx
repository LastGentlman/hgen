'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/types'
import { storage } from '@/lib/storage'
import { generateId } from '@/lib/utils'
import { Plus, Edit2, Trash2, Save, X, Users } from 'lucide-react'

interface EmployeeManagerProps {
  onUpdate: () => void
}

export default function EmployeeManager({ onUpdate }: EmployeeManagerProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})

  useEffect(() => {
    setEmployees(storage.getEmployees())
  }, [])

  const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  const handleAdd = () => {
    setIsAdding(true)
    setFormData({
      name: '',
      department: '',
      maxHoursPerWeek: 40,
      availableDays: [...defaultDays],
      email: '',
      phone: ''
    })
  }

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id)
    setFormData({ ...employee })
  }

  const handleSave = () => {
    if (!formData.name?.trim()) return

    const employeeData: Employee = {
      id: editingId || generateId(),
      name: formData.name.trim(),
      department: formData.department?.trim(),
      maxHoursPerWeek: formData.maxHoursPerWeek || 40,
      availableDays: formData.availableDays || defaultDays,
      email: formData.email?.trim(),
      phone: formData.phone?.trim()
    }

    if (editingId) {
      storage.updateEmployee(editingId, employeeData)
    } else {
      storage.addEmployee(employeeData)
    }

    setEmployees(storage.getEmployees())
    setIsAdding(false)
    setEditingId(null)
    setFormData({})
    onUpdate()
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({})
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      storage.deleteEmployee(id)
      setEmployees(storage.getEmployees())
      onUpdate()
    }
  }

  const handleDayToggle = (day: string) => {
    const currentDays = formData.availableDays || []
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day]

    setFormData({ ...formData, availableDays: newDays })
  }

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
        <button
          onClick={handleAdd}
          className="btn btn-primary flex items-center space-x-2"
          disabled={isAdding || editingId !== null}
        >
          <Plus className="h-5 w-5" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">
            {isAdding ? 'Add New Employee' : 'Edit Employee'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Enter employee name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="input"
                placeholder="Enter department"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Hours Per Week
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={formData.maxHoursPerWeek || 40}
                onChange={(e) => setFormData({ ...formData, maxHoursPerWeek: parseInt(e.target.value) })}
                className="input"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Days
            </label>
            <div className="flex flex-wrap gap-2">
              {allDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayToggle(day)}
                  className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                    (formData.availableDays || []).includes(day)
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3 mt-6">
            <button
              onClick={handleSave}
              className="btn btn-primary flex items-center space-x-2"
              disabled={!formData.name?.trim()}
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleCancel}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Employee List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((employee) => (
          <div key={employee.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-medium text-gray-900">{employee.name}</h3>
                {employee.department && (
                  <p className="text-sm text-gray-600">{employee.department}</p>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleEdit(employee)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isAdding || editingId !== null}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(employee.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  disabled={isAdding || editingId !== null}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {employee.email && (
                <p>📧 {employee.email}</p>
              )}
              {employee.phone && (
                <p>📞 {employee.phone}</p>
              )}
              <p>⏰ Max {employee.maxHoursPerWeek}h/week</p>
              <div>
                <p className="font-medium text-gray-700 mb-1">Available:</p>
                <div className="flex flex-wrap gap-1">
                  {employee.availableDays.map((day) => (
                    <span
                      key={day}
                      className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded"
                    >
                      {day.slice(0, 3)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {employees.length === 0 && !isAdding && (
        <div className="card text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No employees yet</h3>
          <p className="text-gray-600 mb-4">Add your first employee to get started with scheduling.</p>
          <button onClick={handleAdd} className="btn btn-primary">
            Add First Employee
          </button>
        </div>
      )}
    </div>
  )
}