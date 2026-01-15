
import { generateWeeklySchedule, getDefaultShiftTemplates } from './lib/utils';

console.log("Generating schedule with default templates...");
const templates = getDefaultShiftTemplates();
const schedule = generateWeeklySchedule('2023-10-01', 'Test Schedule', templates);

console.log("Checking shift times for first day:");
const firstDay = schedule.days[0];
if (firstDay && firstDay.shifts.length > 0) {
    firstDay.shifts.forEach((shift, index) => {
        console.log(`Shift ${index + 1}: ${shift.startTime} - ${shift.endTime}`);
    });
} else {
    console.log("No shifts found.");
}
