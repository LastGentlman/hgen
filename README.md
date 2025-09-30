# HGen - Work Schedule Generator

A modern web application for generating and managing employee work schedules. Built with Next.js and designed for easy deployment on Vercel.

## Features

- **Employee Management**: Add, edit, and manage employee information including availability
- **Schedule Creation**: Generate weekly schedules with customizable shift templates
- **Visual Schedule View**: Interactive calendar view for assigning employees to shifts
- **Export Options**: Export schedules to CSV and HTML formats
- **Progress Tracking**: Track assignment completion with visual progress indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Local Storage**: Data persists in browser local storage (no database required)

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Vercel
- **Storage**: Browser Local Storage

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd hgen
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Employee Management
- Navigate to the "Employees" tab
- Add employees with their details, availability, and maximum hours
- Edit or remove employees as needed

### 2. Schedule Creation
- Go to the "Schedules" tab
- Create a new weekly schedule with a start date
- The system generates a default template with common shift patterns

### 3. Schedule Assignment
- Use the "View Schedule" tab to assign employees to shifts
- Select employees from dropdown menus for each shift
- Track progress with the visual progress bar
- Export completed schedules to CSV or HTML

## Default Schedule Template

The application includes a built-in template:

- **Monday-Friday**:
  - Manager: 9:00 AM - 5:00 PM
  - Sales Associate: 10:00 AM - 6:00 PM
  - Evening Staff: 2:00 PM - 10:00 PM

- **Saturday**: Weekend Staff: 10:00 AM - 6:00 PM
- **Sunday**: Weekend Staff: 12:00 PM - 8:00 PM

## Deployment on Vercel

### Automatic Deployment (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically deploy on every push to main

### Manual Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to configure your deployment

### Environment Setup

No environment variables are required for basic functionality since the app uses local storage.

## Project Structure

```
hgen/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page component
├── components/            # React components
│   ├── EmployeeManager.tsx
│   ├── ScheduleManager.tsx
│   └── ScheduleView.tsx
├── lib/                   # Utility functions
│   ├── storage.ts         # Local storage operations
│   └── utils.ts           # Helper functions
├── types/                 # TypeScript type definitions
│   └── index.ts
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

## Key Features Explained

### Employee Availability
- Set which days each employee is available
- System only shows available employees for shifts on their available days
- Supports flexible scheduling needs

### Shift Management
- Create shifts with start/end times and position requirements
- Visual indicators show assigned vs unassigned shifts
- Easy drag-and-drop style assignment interface

### Export Capabilities
- **CSV Export**: Spreadsheet-compatible format for external processing
- **HTML Export**: Print-friendly formatted schedules with styling

### Progress Tracking
- Real-time progress bars show completion status
- Color-coded shift indicators (green = assigned, red = unassigned)
- Summary statistics for quick overview

## Customization

### Modifying Default Templates
Edit the `getDefaultShiftTemplates()` function in `lib/utils.ts` to customize the default schedule template.

### Styling
The app uses Tailwind CSS. Modify styles in:
- `app/globals.css` for global styles
- Individual component files for component-specific styling
- `tailwind.config.js` for theme customization

## Browser Compatibility

- Chrome/Chromium-based browsers (recommended)
- Firefox
- Safari
- Edge

## Data Storage

The application uses browser local storage to persist data. This means:
- No server or database required
- Data stays on the user's device
- Easy deployment and setup
- Data persists across browser sessions
- Data is lost if browser storage is cleared

## Future Enhancements

Potential features for future versions:
- Multi-week schedule planning
- Employee time-off management
- Shift swapping functionality
- Email notifications
- Cloud storage integration
- Advanced reporting features

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include browser and version information for bugs