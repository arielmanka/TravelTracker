# Travel Tracker

A simple tool to track how many days you spend in different countries. It helps you stay under visa limits and manage your tax residency status (like the 183-day rule).

## What it does

- **Track your stays**: Log your entry and departure dates, countries, and cities.
- **Upload proof**: Attach boarding passes, hotel bookings, or receipts to back up your records.
- **Calendar view**: See a month-by-month view of where you were. Days where you moved from one country to another are split diagonally showing both countries.
- **Tax & visa status**: Keep track of how many days you spent in a country over the last 365 days or calendar years, and see warnings if you are getting close to a limit.
- **Forecasts**: Calculate when it's safe to return to a country or when you need to leave.
- **PDF Reports**: Generate reports summarizing your stays or proving non-residency.
- **AI Chat**: Ask questions about your travel history using an LLM. This is only a stub of what it could be.

## How days are counted

We use the standard rule for tax presence: **any part of a day counts as a full day of presence**.
- If you leave Country A and arrive in Country B on June 1st, **June 1st counts as a full day in both Country A and Country B**.
- The calendar shows these transition days split diagonally with the colors of both countries.
- The charts and status calculators include these transition days in the counts for both countries.

## Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose (recommended)
- Or Node.js (version 18+) if you want to run it manually.

### Run with Docker (Recommended)

1. Copy `.env.example` to `.env` and fill in any API keys you want to use for the AI chat:
   ```bash
   cp .env.example .env
   ```
2. Start the application:
   ```bash
   docker compose up -d
   ```
3. Open your browser to `http://localhost:3000`.

The app saves its database and uploaded receipts in a `./data` folder in the project root.

---

### Run Locally (Without Docker)

You will need to run the backend and frontend separately.

#### 1. Backend

1. Go to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder (or set variables in your environment):
   ```ini
   PORT=8000
   DATABASE_PATH=../data/travel_tracker.db
   UPLOADS_DIR=../data/receipts
   ```
4. Start the backend dev server:
   ```bash
   npm run dev
   ```
   The backend will run at `http://localhost:8000`.

#### 2. Frontend

1. Go to the `frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend dev server:
   ```bash
   npm run dev
   ```
   The frontend will run at `http://localhost:3000` (or the port shown in your terminal).

---

## Folder Structure

- `/frontend`: React application built with Vite and TypeScript.
- `/backend`: Node.js/Express API server using TypeScript and SQLite.
- `/data`: Folder containing your SQLite database and uploaded documents (receipts/boarding passes).
