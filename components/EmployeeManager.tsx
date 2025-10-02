'use client'

import { useState, useEffect } from 'react'
import { Employee, BranchCode, Division } from '@/types'
import { storage } from '@/lib/storage'
import { generateId } from '@/lib/utils'
import { Plus, Edit2, Trash2, Save, X, Users, Upload, ChevronDown, ChevronUp } from 'lucide-react'

interface EmployeeManagerProps {
  onUpdate: () => void
  branchCode?: BranchCode
  division?: Division
}

export default function EmployeeManager({ onUpdate, branchCode, division }: EmployeeManagerProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedBranchCode, setSelectedBranchCode] = useState<BranchCode>(branchCode || '001')
  const [selectedDivision, setSelectedDivision] = useState<Division>(division || 'super')

  useEffect(() => {
    setEmployees(storage.getEmployees())
  }, [])

  // Keep local selectors in sync when parent context changes
  useEffect(() => {
    if (branchCode) setSelectedBranchCode(branchCode)
    if (division) setSelectedDivision(division)
  }, [branchCode, division])

  const branchOptions: BranchCode[] = ['001', '002', '003']
  const divisionOptions: Division[] = ['super', 'gasolinera', 'restaurant', 'limpieza']

  const defaultDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  const getRandomShift = (): 'morning' | 'afternoon' | 'night' => {
    const shifts: ('morning' | 'afternoon' | 'night')[] = ['morning', 'afternoon', 'night']
    return shifts[Math.floor(Math.random() * shifts.length)]
  }

  const handleAdd = () => {
    setIsAdding(true)
    setFormData({
      name: '',
      phone: '',
      availableDays: [...defaultDays],
      assignedShift: getRandomShift(),
      branchCode: selectedBranchCode,
      division: selectedDivision
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
      phone: formData.phone?.trim(),
      availableDays: [...defaultDays],
      assignedShift: (formData.assignedShift as any) || 'unassigned',
      branchCode: (formData.branchCode as BranchCode) || selectedBranchCode,
      division: (formData.division as Division) || selectedDivision
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

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)

        let namesToImport: string[] = []

        // Support multiple JSON formats
        if (Array.isArray(data)) {
          namesToImport = data
        } else if (data.employees && Array.isArray(data.employees)) {
          namesToImport = data.employees
        } else {
          alert('Invalid JSON format. Expected an array of names or an object with "employees" array.')
          return
        }

        // Create employee objects from names
        const newEmployees: Employee[] = namesToImport.map(name => ({
          id: generateId(),
          name: typeof name === 'string' ? name : String(name),
          availableDays: [...defaultDays],
          assignedShift: getRandomShift(),
          branchCode: selectedBranchCode,
          division: selectedDivision
        }))

        // Add all new employees
        newEmployees.forEach(emp => storage.addEmployee(emp))

        setEmployees(storage.getEmployees())
        onUpdate()
        alert(`Successfully imported ${newEmployees.length} employees!`)
      } catch (error) {
        alert('Error parsing JSON file. Please check the file format.')
        console.error(error)
      }
    }
    reader.readAsText(file)

    // Reset input
    event.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-primary-600" />
            <div className="text-left">
              <h2 className="text-xl font-bold text-gray-900">Employee Management</h2>
              <p className="text-sm text-gray-600">
                {employees.filter(emp =>
                  (!emp.branchCode || emp.branchCode === selectedBranchCode) &&
                  (!emp.division || emp.division === selectedDivision)
                ).length} employees
              </p>
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
            {/* Context selectors (read-only when provided by parent) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                <select
                  value={selectedBranchCode}
                  onChange={(e) => setSelectedBranchCode(e.target.value as BranchCode)}
                  className="input"
                >
                  {branchOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">División</label>
                <select
                  value={selectedDivision}
                  onChange={(e) => setSelectedDivision(e.target.value as Division)}
                  className="input"
                >
                  {divisionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2">
              <label className="btn btn-secondary flex items-center space-x-2 cursor-pointer">
                <Upload className="h-5 w-5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleAdd}
                className="btn btn-primary flex items-center space-x-2"
                disabled={isAdding || editingId !== null}
              >
                <Plus className="h-5 w-5" />
                <span>Add Employee</span>
              </button>
            </div>

      {/* Add Form - Only at top when adding */}
      {isAdding && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Add New Employee</h3>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
              <select
                value={(formData.branchCode as BranchCode) || selectedBranchCode}
                onChange={(e) => setFormData({ ...formData, branchCode: e.target.value as BranchCode })}
                className="input"
              >
                {branchOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">División</label>
              <select
                value={(formData.division as Division) || selectedDivision}
                onChange={(e) => setFormData({ ...formData, division: e.target.value as Division })}
                className="input"
              >
                {divisionOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Shift
              </label>
              <select
                value={(formData.assignedShift as any) || 'unassigned'}
                onChange={(e) => setFormData({ ...formData, assignedShift: e.target.value as any })}
                className="input"
              >
                <option value="unassigned">Sin asignar</option>
                <option value="morning">Turno 1 (7:00 - 15:00)</option>
                <option value="afternoon">Turno 2 (15:00 - 23:00)</option>
                <option value="night">Turno 3 (23:00 - 7:00)</option>
              </select>
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

      {/* Employee List (filtered by context when provided) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees
          .filter(emp =>
            (!emp.branchCode || emp.branchCode === selectedBranchCode) &&
            (!emp.division || emp.division === selectedDivision)
          )
          .map((employee) => (
          <div key={employee.id}>
            <div className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{employee.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {employee.branchCode && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">Sucursal {employee.branchCode}</span>
                    )}
                    {employee.division && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border capitalize">{employee.division}</span>
                    )}
                  </div>
                  {employee.phone && (
                    <p className="text-sm text-gray-600">📞 {employee.phone}</p>
                  )}
                  {employee.assignedShift && employee.assignedShift !== 'unassigned' && (
                    <p className="text-xs text-primary-600 font-medium mt-1">
                      {employee.assignedShift === 'morning' && '🌅 Turno 1 (7-15)'}
                      {employee.assignedShift === 'afternoon' && '☀️ Turno 2 (15-23)'}
                      {employee.assignedShift === 'night' && '🌙 Turno 3 (23-7)'}
                    </p>
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
            </div>

            {/* Edit Form - Appears below the employee card */}
            {editingId === employee.id && (
              <div className="card mt-2 bg-blue-50 border-blue-200">
                <h3 className="text-lg font-medium mb-4">Edit Employee</h3>

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                    <select
                      value={(formData.branchCode as BranchCode) || employee.branchCode || selectedBranchCode}
                      onChange={(e) => setFormData({ ...formData, branchCode: e.target.value as BranchCode })}
                      className="input"
                    >
                      {branchOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">División</label>
                    <select
                      value={(formData.division as Division) || employee.division || selectedDivision}
                      onChange={(e) => setFormData({ ...formData, division: e.target.value as Division })}
                      className="input"
                    >
                      {divisionOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned Shift
                    </label>
                    <select
                      value={(formData.assignedShift as any) || 'unassigned'}
                      onChange={(e) => setFormData({ ...formData, assignedShift: e.target.value as any })}
                      className="input"
                    >
                      <option value="unassigned">Sin asignar</option>
                      <option value="morning">Turno 1 (7:00 - 15:00)</option>
                      <option value="afternoon">Turno 2 (15:00 - 23:00)</option>
                      <option value="night">Turno 3 (23:00 - 7:00)</option>
                    </select>
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
          </div>
        ))}
      </div>

            {employees.length === 0 && !isAdding && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No employees yet</h3>
                <p className="text-gray-600 mb-4">Add your first employee to get started with scheduling.</p>
                <button onClick={handleAdd} className="btn btn-primary">
                  Add First Employee
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}