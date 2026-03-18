# SchoolHub: School Management and Learning Platform

SchoolHub is a Laravel + Inertia + React monolith for school operations across academics, enrollment, finance, student services, and role-specific portals.

This README was updated from a direct codebase audit (routes, controllers, models, migrations, pages, workflows, and scripts).

## Current System Snapshot

- Backend framework: Laravel 12
- Frontend framework: React 19 + TypeScript + Inertia.js 2
- CSS/UI: Tailwind CSS 4 + Radix/shadcn components
- Database: MySQL in production, SQLite supported for local/testing
- Authentication: Laravel Fortify + role middleware
- Build tool: Vite 7
- Test runner: Pest

Codebase inventory (from repository scan):
- 95 controllers in app/Http/Controllers
- 48 models in app/Models
- 94 migrations in database/migrations
- 151 TSX pages in resources/js/pages
- 21 TSX layouts in resources/js/layouts
- 16 test files in tests
- 529 named routes in route list

Role route counts:
- owner: 66
- registrar: 87
- accounting: 111
- super-accounting: 71
- student: 42
- teacher: 39
- parent: 16
- guidance: 18
- librarian: 19
- clinic: 12
- canteen: 12

## Core Architecture

SchoolHub follows a modular monolith design:

- HTTP entry and routing are centralized in routes/web.php
- Role access control is enforced using the role middleware alias from bootstrap/app.php
- Controllers are grouped by domain/role under app/Http/Controllers
- Inertia pages are grouped by role under resources/js/pages
- Role-specific layouts and sidebars are under resources/js/layouts and resources/js/components
- Shared settings/profile screens are under resources/js/pages/role-settings

Important middleware aliases:
- role -> EnsureUserHasRole
- enrolled -> EnsureStudentEnrolled
- student.active -> EnsureStudentActive

## Roles and Portals

User role constants are defined in app/Models/User.php:
- owner
- registrar
- accounting
- super-accounting
- student
- teacher
- parent
- guidance
- librarian
- clinic
- canteen

Portal route prefixes:
- /owner
- /registrar
- /accounting
- /super-accounting
- /student
- /teacher
- /parent
- /guidance
- /librarian
- /clinic
- /canteen

## Functional Coverage

### Owner
- Dashboard and income pages (today, overall, expected)
- Reports and audit reports
- Audit logs for balance adjustments
- User management
- Academic structure management (departments, programs, year levels, sections, subjects, schedules)
- Announcements and app settings

### Registrar
- Student lifecycle management
- Clearance updates, re-enrollment, deactivation/activation
- Requirements and document workflows
- Class assignment and schedules
- Drop request and student status workflows
- Reports and deadline management

### Accounting
- Dashboards (overview and account-level)
- Student accounts and payment processing
- Fee management and assignments
- Grants, promissory notes, exam approval
- Document approvals and drop approvals
- Online transactions, refunds, reports

### Super Accounting
- Accounting oversight routes and dashboards
- Cross-account visibility in account dashboard
- Reports, refunds, fee management, document/drop approvals

### Teacher
- Dashboard, classes, subjects, schedules
- Quiz CRUD and grading flows
- Grade and attendance pages
- Teacher profile management

### Student
- Dashboard, profile, schedules, subjects
- Enrollment and college subject enrollment
- Requirements, quizzes, document requests, online payments
- Promissory notes and drop requests

### Parent
- Dashboard with child-focused views
- Subject, schedule, fee, and requirement pages

### Guidance
- Dashboard and guidance records
- Student browsing and record management

### Librarian
- Dashboard, books, transactions

### Clinic and Canteen
- Baseline portal dashboards with routing, settings, and announcements integration

## Finance and Analytics Notes

The codebase has multiple finance surfaces with different scopes. Use the label definitions below when maintaining analytics:

- Fee-ledger metrics:
  - Based on student fee records and student fee payments
  - Used for receivables/balance-focused pages
- Transaction-processed metrics:
  - Includes fee payments plus paid document requests plus paid drop requests
  - Used for transaction dashboards and throughput summaries

When adding or changing cards/graphs, keep scope labels explicit in UI text to avoid cross-page confusion.

## Database and Schema

Migrations include core platform modules:
- User/auth foundations and role expansions
- Academic structure (departments, programs, year levels, sections, strands)
- Student lifecycle and requirements
- Financial records (student_fees, student_payments, grants, refunds, promissory notes)
- Document requests and approvals
- Drop request workflow
- Quiz engine tables
- Library, guidance, clinic, and canteen expansions

Current migration count: 94

## Frontend and UI

Frontend stack and conventions:
- React 19 + TypeScript strict mode
- Inertia page rendering from Laravel controllers
- Alias imports via @/* mapped to resources/js/*
- Tailwind CSS 4 with reusable UI primitives
- Shared filtering and table patterns across reporting screens

Vite dev server defaults:
- host: 0.0.0.0
- port: 5174

## Local Development Setup

### Requirements
- PHP 8.2+
- Composer 2+
- Node.js 22+ recommended
- npm
- MySQL 8+ (optional for local if using SQLite)

### 1) Install dependencies

```bash
composer install
npm install
```

### 2) Environment and key

```bash
cp .env.example .env
php artisan key:generate
```

### 3) Database

Option A: SQLite quick start
- Keep DB_CONNECTION=sqlite
- Ensure database file exists if needed

Option B: MySQL
- Update DB_* variables in .env
- Run migrations

```bash
php artisan migrate
```

### 4) Seed baseline users

```bash
php artisan db:seed
```

DatabaseSeeder currently calls RoleBasedUserSeeder.

### 5) Run app

Terminal 1:
```bash
php artisan serve --port=8001
```

Terminal 2:
```bash
npm run dev
```

Or run composite dev command:
```bash
composer dev
```

## Default Seeded Accounts

From database/seeders/RoleBasedUserSeeder.php:

- owner@gmail.com
- registrar@gmail.com
- accounting@gmail.com
- super.accounting@gmail.com
- teacher@gmail.com
- parent@gmail.com
- guidance@gmail.com
- librarian@gmail.com
- clinic@gmail.com
- canteen@gmail.com
- sample student accounts (multiple)

Default password used by seeder: password

Change seeded credentials immediately outside local development.

## Build, Lint, and Test

Frontend scripts (package.json):

```bash
npm run dev
npm run build
npm run build:ssr
npm run lint
npm run format
npm run types
```

Backend scripts (composer.json):

```bash
composer lint
composer test
composer dev
composer dev:ssr
```

CI workflows:
- .github/workflows/lint.yml
- .github/workflows/tests.yml
- .github/workflows/deploy.yml

## Deployment

Production deployment is GitHub Actions based (master branch push):

- Workflow: .github/workflows/deploy.yml
- Server sync via rsync
- Post-deploy tasks:
  - storage symlink assurance
  - cache clear/optimize
  - migrations
  - grant sync command

Main production target currently referenced in workflow:
- https://westerncollegesinc.ph

See these docs for environment-specific details:
- DEPLOYMENT.md
- HOW-TO-DEPLOY.md

## Project Structure

Top-level high-signal directories:

- app/
  - Http/Controllers/
  - Models/
  - Middleware/
- database/
  - migrations/
  - seeders/
- resources/
  - js/pages/
  - js/layouts/
  - js/components/
  - css/
- routes/
  - web.php
  - settings.php
- tests/
- .github/workflows/

## Troubleshooting

### Route or permission issues

```bash
php artisan route:clear
php artisan config:clear
php artisan cache:clear
php artisan optimize:clear
```

### Frontend build issues

```bash
rm -r node_modules
npm install
npm run build
```

### DB reset (local only)

```bash
php artisan migrate:fresh --seed
```

### Verify routes by role prefix

```bash
php artisan route:list --name=owner.
php artisan route:list --name=accounting.
php artisan route:list --name=super-accounting.
```

## Related Documentation

- SETUP.md
- DEPLOYMENT.md
- HOW-TO-DEPLOY.md
- IMPLEMENTATION.md
- CHANGELOG.md
- TODO.md

## Maintenance Guidelines

- Keep role modules aligned between route groups, controllers, and sidebars
- Keep analytics scope definitions explicit in controller code and UI labels
- Prefer small, isolated changes and verify with lint/build/tests
- Update this README when route groups, workflows, or setup scripts change

## License

This repository currently uses the Laravel starter MIT baseline from composer metadata.
Review and update licensing policy as needed for your organization.
