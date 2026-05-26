# NFC Tracking Service

A lightweight analytics + redirect system for NFC digital business cards.

## Features
- NFC tap tracking
- IP-based location detection
- Redirect to static business cards
- PostgreSQL analytics storage
- Unique visitor stats

## Setup

### 1. Install dependencies
npm install

### 2. Setup database
Run sql/schema.sql in PostgreSQL

### 3. Environment variables
Copy .env.example → .env

### 4. Run locally
npm start

## Endpoints

### Tracking
/t/:slug

### Stats
/stats/:slug

### Create card (test)
/cards