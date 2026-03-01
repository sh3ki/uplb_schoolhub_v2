# How to Deploy - Step by Step Guide

## Overview

```
Your Computer (local)
       │
       └─ push to master branch ──► westerncollegesinc.ph  (production/live)
```

**YES** — pushing to `master` automatically deploys to `https://westerncollegesinc.ph`.

GitHub Actions handles the build and deployment. You do NOT need to do anything else.

---

## Login Accounts

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@gmail.com | password |
| Registrar | registrar@gmail.com | password |
| Accounting | accounting@gmail.com | password |
| Super Accounting | super.accounting@gmail.com | password |
| Teacher | teacher@gmail.com | password |
| Student | student@gmail.com | password |

---

## Step 1: Work Locally

Do your coding, test everything at `http://127.0.0.1:8001`.

```bash
# Start local server
php artisan serve --port=8001

# Start Vite (in separate terminal)
npm run dev
```

---

## Step 2: Push to Production (Live Site)

```bash
git add -A
git commit -m "feat: your feature description"
git push origin master
```

Wait ~2 minutes, then open: **https://westerncollegesinc.ph**

---

## Full Example Workflow

```bash
# 1. Make your changes locally, test at localhost:8001

# 2. Commit your changes
git add -A
git commit -m "feat: Add new student feature"

# 3. Deploy to production
git push origin master
# → Visit https://westerncollegesinc.ph to verify
```

---

## Checking Deployment Status

Go to: **https://github.com/LeeDev428/uplb_schoolhub/actions**

Look for **"Deploy to Production"** workflows:
- Green ✅ = deployed successfully
- Red ✗ = something failed (click to see logs)

### About the red linter/tests failures:
The **linter** and **tests** workflows failing in red is **NORMAL and expected**.
They do **NOT** affect the actual deployment at all.

Only care about **"Deploy to Production"** being green.

---

## If Something Goes Wrong

### Check Laravel logs on server

```bash
# SSH into server (from Windows terminal)
ssh -i C:\Users\grafr\.ssh\hostinger_deploy -p 65002 u866511543@72.61.121.165

# Check production logs
tail -50 ~/westerncollege/storage/logs/laravel.log
```

### Clear cache on server

```bash
cd ~/westerncollege && php artisan config:clear && php artisan cache:clear && php artisan view:clear
```
