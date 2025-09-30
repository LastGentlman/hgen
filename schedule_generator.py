#!/usr/bin/env python3
"""
Simple Work Schedule Generator
A tool to generate employee work schedules
"""

import json
import csv
import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
import argparse

@dataclass
class Employee:
    name: str
    id: str
    department: Optional[str] = None
    max_hours_per_week: int = 40
    available_days: List[str] = None

    def __post_init__(self):
        if self.available_days is None:
            self.available_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

@dataclass
class Shift:
    start_time: str
    end_time: str
    position: str
    employee_id: Optional[str] = None

class ScheduleGenerator:
    def __init__(self):
        self.employees: List[Employee] = []
        self.schedule: Dict[str, Dict[str, List[Shift]]] = {}

    def add_employee(self, employee: Employee):
        """Add an employee to the system"""
        self.employees.append(employee)

    def remove_employee(self, employee_id: str):
        """Remove an employee from the system"""
        self.employees = [emp for emp in self.employees if emp.id != employee_id]

    def get_employee(self, employee_id: str) -> Optional[Employee]:
        """Get employee by ID"""
        for emp in self.employees:
            if emp.id == employee_id:
                return emp
        return None

    def create_weekly_schedule(self, start_date: str, shifts_per_day: Dict[str, List[Shift]]):
        """
        Create a weekly schedule
        start_date: YYYY-MM-DD format
        shifts_per_day: Dict with day names as keys and list of shifts as values
        """
        start = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        schedule = {}
        for i, day in enumerate(days):
            current_date = start + datetime.timedelta(days=i)
            date_str = current_date.strftime("%Y-%m-%d")
            schedule[date_str] = {
                "day": day,
                "shifts": shifts_per_day.get(day, [])
            }

        self.schedule = schedule
        return schedule

    def assign_employee_to_shift(self, date: str, shift_index: int, employee_id: str):
        """Assign an employee to a specific shift"""
        if date in self.schedule and shift_index < len(self.schedule[date]["shifts"]):
            employee = self.get_employee(employee_id)
            if employee and self.schedule[date]["day"] in employee.available_days:
                self.schedule[date]["shifts"][shift_index].employee_id = employee_id
                return True
        return False

    def export_to_csv(self, filename: str):
        """Export schedule to CSV format"""
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)

            # Header
            writer.writerow(["Date", "Day", "Start Time", "End Time", "Position", "Employee"])

            # Data
            for date, day_data in self.schedule.items():
                for shift in day_data["shifts"]:
                    employee_name = ""
                    if shift.employee_id:
                        emp = self.get_employee(shift.employee_id)
                        employee_name = emp.name if emp else shift.employee_id

                    writer.writerow([
                        date,
                        day_data["day"],
                        shift.start_time,
                        shift.end_time,
                        shift.position,
                        employee_name
                    ])

    def export_to_html(self, filename: str):
        """Export schedule to HTML format"""
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Work Schedule</title>
            <style>
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .date { font-weight: bold; }
                .unassigned { background-color: #ffe6e6; }
            </style>
        </head>
        <body>
            <h1>Work Schedule</h1>
            <table>
                <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Position</th>
                    <th>Employee</th>
                </tr>
        """

        for date, day_data in self.schedule.items():
            for shift in day_data["shifts"]:
                employee_name = "UNASSIGNED"
                css_class = "unassigned"

                if shift.employee_id:
                    emp = self.get_employee(shift.employee_id)
                    employee_name = emp.name if emp else shift.employee_id
                    css_class = ""

                html_content += f"""
                <tr class="{css_class}">
                    <td class="date">{date}</td>
                    <td>{day_data["day"]}</td>
                    <td>{shift.start_time} - {shift.end_time}</td>
                    <td>{shift.position}</td>
                    <td>{employee_name}</td>
                </tr>
                """

        html_content += """
            </table>
        </body>
        </html>
        """

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)

    def print_schedule(self):
        """Print schedule to console"""
        print("\n=== WORK SCHEDULE ===\n")

        for date, day_data in self.schedule.items():
            print(f"{date} ({day_data['day']})")
            print("-" * 50)

            if not day_data["shifts"]:
                print("  No shifts scheduled")
            else:
                for i, shift in enumerate(day_data["shifts"]):
                    employee_name = "UNASSIGNED"
                    if shift.employee_id:
                        emp = self.get_employee(shift.employee_id)
                        employee_name = emp.name if emp else shift.employee_id

                    print(f"  {shift.start_time}-{shift.end_time} | {shift.position} | {employee_name}")
            print()

    def save_data(self, filename: str):
        """Save employees and schedule data to JSON"""
        data = {
            "employees": [asdict(emp) for emp in self.employees],
            "schedule": self.schedule
        }
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def load_data(self, filename: str):
        """Load employees and schedule data from JSON"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)

            self.employees = [Employee(**emp_data) for emp_data in data.get("employees", [])]
            self.schedule = data.get("schedule", {})
            return True
        except FileNotFoundError:
            print(f"File {filename} not found")
            return False
        except json.JSONDecodeError:
            print(f"Invalid JSON in {filename}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Work Schedule Generator')
    parser.add_argument('--load', help='Load data from JSON file')
    parser.add_argument('--save', help='Save data to JSON file')
    parser.add_argument('--export-csv', help='Export schedule to CSV file')
    parser.add_argument('--export-html', help='Export schedule to HTML file')

    args = parser.parse_args()

    generator = ScheduleGenerator()

    # Load data if specified
    if args.load:
        generator.load_data(args.load)

    print("Work Schedule Generator")
    print("Type 'help' for commands")

    while True:
        try:
            command = input("\n> ").strip().lower()

            if command == 'help':
                print("""
Available commands:
  help              - Show this help
  add employee      - Add a new employee
  list employees    - List all employees
  create schedule   - Create a weekly schedule template
  assign shift      - Assign employee to shift
  show schedule     - Display current schedule
  save             - Save data to file
  export csv       - Export to CSV
  export html      - Export to HTML
  quit             - Exit program
                """)

            elif command == 'add employee':
                name = input("Employee name: ")
                emp_id = input("Employee ID: ")
                dept = input("Department (optional): ") or None
                max_hours = input("Max hours per week (default 40): ") or "40"

                employee = Employee(name=name, id=emp_id, department=dept, max_hours_per_week=int(max_hours))
                generator.add_employee(employee)
                print(f"Added employee: {name}")

            elif command == 'list employees':
                if not generator.employees:
                    print("No employees added yet")
                else:
                    print("\nEmployees:")
                    for emp in generator.employees:
                        print(f"  {emp.id}: {emp.name} ({emp.department or 'No dept'})")

            elif command == 'create schedule':
                start_date = input("Start date (YYYY-MM-DD): ")

                # Simple template - you can customize this
                shifts_template = {
                    "Monday": [
                        Shift("09:00", "17:00", "Manager"),
                        Shift("10:00", "18:00", "Sales Associate"),
                        Shift("14:00", "22:00", "Evening Shift")
                    ],
                    "Tuesday": [
                        Shift("09:00", "17:00", "Manager"),
                        Shift("10:00", "18:00", "Sales Associate")
                    ],
                    "Wednesday": [
                        Shift("09:00", "17:00", "Manager"),
                        Shift("10:00", "18:00", "Sales Associate")
                    ],
                    "Thursday": [
                        Shift("09:00", "17:00", "Manager"),
                        Shift("10:00", "18:00", "Sales Associate")
                    ],
                    "Friday": [
                        Shift("09:00", "17:00", "Manager"),
                        Shift("10:00", "18:00", "Sales Associate"),
                        Shift("14:00", "22:00", "Evening Shift")
                    ],
                    "Saturday": [
                        Shift("10:00", "18:00", "Weekend Staff")
                    ],
                    "Sunday": [
                        Shift("12:00", "20:00", "Weekend Staff")
                    ]
                }

                generator.create_weekly_schedule(start_date, shifts_template)
                print("Weekly schedule template created")

            elif command == 'assign shift':
                if not generator.schedule:
                    print("No schedule created yet. Use 'create schedule' first.")
                    continue

                print("\nAvailable dates:")
                for i, (date, day_data) in enumerate(generator.schedule.items()):
                    print(f"  {i}: {date} ({day_data['day']})")

                try:
                    date_index = int(input("Select date (number): "))
                    selected_date = list(generator.schedule.keys())[date_index]

                    print(f"\nShifts for {selected_date}:")
                    shifts = generator.schedule[selected_date]["shifts"]
                    for i, shift in enumerate(shifts):
                        employee_name = "UNASSIGNED"
                        if shift.employee_id:
                            emp = generator.get_employee(shift.employee_id)
                            employee_name = emp.name if emp else shift.employee_id
                        print(f"  {i}: {shift.start_time}-{shift.end_time} {shift.position} ({employee_name})")

                    shift_index = int(input("Select shift (number): "))

                    print("\nAvailable employees:")
                    for i, emp in enumerate(generator.employees):
                        print(f"  {i}: {emp.name} ({emp.id})")

                    emp_index = int(input("Select employee (number): "))
                    employee_id = generator.employees[emp_index].id

                    if generator.assign_employee_to_shift(selected_date, shift_index, employee_id):
                        print("Assignment successful")
                    else:
                        print("Assignment failed - employee may not be available on this day")

                except (ValueError, IndexError):
                    print("Invalid selection")

            elif command == 'show schedule':
                if generator.schedule:
                    generator.print_schedule()
                else:
                    print("No schedule created yet")

            elif command == 'save':
                filename = input("Filename (default: schedule_data.json): ") or "schedule_data.json"
                generator.save_data(filename)
                print(f"Data saved to {filename}")

            elif command == 'export csv':
                if not generator.schedule:
                    print("No schedule to export")
                    continue
                filename = input("CSV filename (default: schedule.csv): ") or "schedule.csv"
                generator.export_to_csv(filename)
                print(f"Schedule exported to {filename}")

            elif command == 'export html':
                if not generator.schedule:
                    print("No schedule to export")
                    continue
                filename = input("HTML filename (default: schedule.html): ") or "schedule.html"
                generator.export_to_html(filename)
                print(f"Schedule exported to {filename}")

            elif command == 'quit':
                break

            else:
                print("Unknown command. Type 'help' for available commands.")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

    # Save and export if specified via command line
    if args.save:
        generator.save_data(args.save)
        print(f"Data saved to {args.save}")

    if args.export_csv:
        generator.export_to_csv(args.export_csv)
        print(f"Schedule exported to {args.export_csv}")

    if args.export_html:
        generator.export_to_html(args.export_html)
        print(f"Schedule exported to {args.export_html}")

if __name__ == "__main__":
    main()