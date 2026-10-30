# HT Impact Manager

Program, beneficiary, and attendance management for HT Digital Solutions.

The app is a Next.js system with PostgreSQL, role-based access, English and Arabic, Excel and PDF reports, and offline queues for attendance and project assignments.

## Local launch

PostgreSQL runs as a local database process from this project. It does not require a system-wide Postgres install.

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`. For this demonstration, the local file should contain:

```bash
DATABASE_URL="postgresql://htimpact:htimpact_local@127.0.0.1:54329/ht_impact_manager?schema=public"
NEXTAUTH_SECRET="generate-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="same-long-random-string"
AUTH_URL="http://localhost:3000"

# Local development only. Never set these in production.
DEMO_LOGIN_ENABLED="true"
DEMO_USER_EMAIL="htdigital@gmail.com"
DEMO_USER_PASSWORD="1234"
DEMO_STAFF_PASSWORD="LocalStaff!2026"
```

Copy the same `DATABASE_URL` into `.env` so Prisma can see it. Both files are gitignored.

Demo sign-in is refused unless `NODE_ENV` is `development` and `DEMO_LOGIN_ENABLED` is `true`. The password is read only while seeding. It is not hardcoded in the application, and a production build will not accept the demo account.

3. Start the database, apply migrations, and load the demo programs:

```bash
npm run db:start
```

In a second terminal:

```bash
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Or, after the first migration exists:

```bash
npm run dev:all
```

4. Open [http://localhost:3000](http://localhost:3000).

### Local accounts

These accounts exist only after the development seed:

| Email | Password | Role |
| --- | --- | --- |
| htdigital@gmail.com | 1234 | Administrator, local demo only |
| layla.haddad@example.com | LocalStaff!2026 | Facilitator |
| nabil.qasem@example.com | LocalStaff!2026 | Viewer |

The login page shows a warning while demo sign-in is enabled. Do not deploy `.env.local`, `DEMO_LOGIN_ENABLED`, or the local database.

## What to try

1. Create a project and set at least one target. Progress is calculated from live records.
2. Add a staff member and choose a role.
3. Register a beneficiary and attach that same record to more than one project.
4. On an educational project, add a course, a cohort, and a session, then enroll the beneficiary and take attendance.
5. On a non-educational project, add an activity and log participation.
6. Export Excel or PDF from Reports.
7. Turn on **Queue on this device**, save attendance or a project link, turn the queue off, and sync. Open Sync to review conflicts.

## Conflict rules

Attendance is one row per session and beneficiary.

- The same status is ignored.
- If the server has not changed since the sheet was opened, the field mark wins.
- A mark taken from 15 minutes before the session until 2 hours after it ends replaces a server edit made outside that window.
- A field mark outside that window does not replace the server.
- If both marks were taken during the session and they disagree, the server value stays until someone chooses Keep server or Keep field record.

Project assignment never copies a person.

- A missing link is created.
- An active link is left as-is.
- A withdraw is blocked when server notes changed after the device copied them, or when the device has no base version.
- Reactivating a withdrawal that happened after the copy is held for review.

## Scripts

- `npm run dev` — Next.js. On macOS 12 the compiler uses its WebAssembly build automatically, so the first start is slower.
- `npm run db:start` — local PostgreSQL
- `npm run dev:all` — database and Next.js together
- `npm run db:setup` — apply migrations and seed
- `npm run check:rules` — conflict-rule checks
- `npm run build` — production build
