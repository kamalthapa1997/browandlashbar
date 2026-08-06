# Mero Brow & Lash Bar

This repository contains the React frontend and a Node.js/Express backend for managing services, gallery content, and brand settings.

## Setup

1. Copy `.env.example` to `.env`.
2. Add your MongoDB connection string, JWT secret, and Cloudinary credentials.
3. Optionally set `ADMIN_USERNAME` and `ADMIN_PASSWORD` to auto-create the first admin account on startup.

## Scripts

- `npm run client`: starts the React app on `http://localhost:3000`
- `npm run server`: starts the Express API with nodemon
- `npm run dev`: runs both frontend and backend together
- `npm start`: runs the backend in production mode
- `npm run build`: builds the React frontend

## Backend routes

### Public

- `GET /api/services`
- `GET /api/gallery`
- `PATCH /api/gallery/:id/like`
- `GET /api/settings`

### Admin

- `POST /api/admin/login`
- `POST /api/services`
- `PUT /api/services/:id`
- `DELETE /api/services/:id`
- `POST /api/gallery`
- `DELETE /api/gallery/:id`
- `PUT /api/settings`

Protected routes require `Authorization: Bearer <token>`.

## Upload fields

- Gallery uploads use the multipart field name `image`
- Logo uploads use the multipart field name `logo`
