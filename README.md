# VELARIS LUX LIVING

Ultra-luxury furniture website + backend management system.

## Stack
- Node.js + Express
- SQLite database
- Session auth (admin login)
- Multer image uploads
- Vanilla HTML/CSS/JS frontend + admin dashboard

## Features
- Cinematic luxury frontend with category pages (`sofas`, `beds`, `chairs`, `tables`)
- Dynamic product loading from backend inventory
- Product detail pages with materials and craftsmanship story
- Inquiry system storing customer + inquiry data
- Secure admin dashboard:
  - Login/logout
  - Add/edit/delete products
  - Upload product images
  - Featured toggle
  - Availability + visibility controls
  - Stock tracking
  - Inquiry status management
  - Customer database
  - Basic analytics cards
- Admin product changes instantly reflect on frontend pages

## Project Structure
- `/src` backend server + DB init
- `/public` luxury website pages
- `/admin` admin login/dashboard assets
- `/uploads` uploaded product images
- `/data` SQLite database + session storage

## Setup
1. Install Node.js 18+.
2. Create env file:
   - `cp .env.example .env`
3. Install dependencies:
   - `npm install`
4. Start server:
   - `npm start`
5. Open:
   - Website: `http://localhost:3000`
   - Admin: `http://localhost:3000/admin`

## Default Admin Credentials
Configured from environment values:
- `ADMIN_USERNAME` (default: `admin`)
- `ADMIN_PASSWORD` (default: `Velaris@123`)

Set custom credentials in `.env` before first run.

## Security Notes
- Change `SESSION_SECRET` in `.env`.
- Change default admin credentials in production.
- Use HTTPS and secure cookies for production deployment.
# velaris-website
# velaris-website
# velaris-website
# velaris-website
