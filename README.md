# WVSU Alumni Tracking System

A modern alumni management system for West Visayas State University with Director module access, analytics dashboard, and report generation capabilities.

## 🎨 Design System

- **Primary Color:** Royal Blue (`#1e3a8a`)
- **Secondary Color:** Accent Yellow (`#facc15`)
- **Background:** Clean Light (`#fcfcfd`)
- **Typography:** Inter, system-ui

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm (or yarn/pnpm)
- Supabase account (free tier works)

### Install

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run

```bash
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

## 🔑 Default Login Credentials

- **Username:** `director`
- **Password:** `WVSU@1234`

## 📁 Project Structure

```
.
├── index.html
├── director/
│   ├── dashboard.html
│   └── management.html
├── src/
│   ├── supabase.js
│   ├── auth.js
│   ├── charts.js
│   ├── management.js
│   └── reports.js
├── style.css
├── .env
└── package.json
```

## 🗄️ Supabase Database Schema

Run in Supabase SQL Editor:

```sql
CREATE TABLE alumni (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  graduation_year INT NOT NULL,
  course TEXT NOT NULL,
  batch TEXT,
  employment_status TEXT CHECK (employment_status IN ('Employed', 'Unemployed', 'Self-Employed', 'Abroad')),
  current_company TEXT,
  current_city TEXT,
  is_local BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alumni_id UUID REFERENCES alumni(id),
  event_name TEXT,
  attended BOOLEAN DEFAULT false,
  donated BOOLEAN DEFAULT false,
  mentorship_participated BOOLEAN DEFAULT false,
  event_date DATE
);
```

## 🗄️ Sample Data (optional)

```sql
INSERT INTO alumni (full_name, graduation_year, course, batch, employment_status, current_company, current_city, is_local) VALUES
('Juan Dela Cruz', 2023, 'BS Computer Science', 'Batch 2023', 'Employed', 'Google', 'Manila', true),
('Maria Santos', 2022, 'BS Information Technology', 'Batch 2022', 'Employed', 'Microsoft', 'Seattle', false),
('Jose Rizal', 2023, 'BS Computer Engineering', 'Batch 2023', 'Self-Employed', 'Freelance', 'Cebu', true),
('Andres Bonifacio', 2021, 'BS Information Systems', 'Batch 2021', 'Employed', 'Amazon', 'Manila', true),
('Gabriela Silang', 2024, 'BS Computer Science', 'Batch 2024', 'Unemployed', NULL, 'Iloilo', true),
('Apolinario Mabini', 2022, 'BS Information Technology', 'Batch 2022', 'Abroad', 'Tech Corp', 'Singapore', false),
('Melchora Aquino', 2023, 'BS Computer Engineering', 'Batch 2023', 'Employed', 'Apple', 'California', false),
('Lapu-Lapu', 2024, 'BS Information Systems', 'Batch 2024', 'Employed', 'Shopee', 'Cebu', true);

INSERT INTO events (alumni_id, event_name, attended, donated, mentorship_participated, event_date)
SELECT id, 'Career Fair 2024', true, false, true, '2024-01-15' FROM alumni LIMIT 5;
```

