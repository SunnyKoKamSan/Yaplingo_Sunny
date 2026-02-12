# Gamification Seeding & Testing Scripts

This directory contains scripts for populating and verifying the gamification system with test data.

## 📁 Files

- **`seed_gamification.py`** - Main seeding script that creates test users and historical data
- **`verify_gamification.py`** - Verification script to inspect and validate seeded data
- **`run_seed.sh`** - Helper script to run both seed and verify with correct environment

## 🚀 Quick Start

### Prerequisites

1. **PostgreSQL running**: Ensure the database container is running
   ```bash
   cd server
   docker compose up database -d
   ```

2. **Verify database is accessible**:
   ```bash
   docker ps | grep postgres
   # Should show yaplingo-database-1 running on port 5432
   ```

### Option 1: Using Helper Script (Recommended)

```bash
cd server/scripts
./run_seed.sh
```

This will:
- Set the correct DATABASE_URL for localhost
- Run the seeding script
- Automatically run the verification script

### Option 2: Manual Commands

```bash
cd server

# Seed the database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo \
  uv run python scripts/seed_gamification.py

# Verify the seeded data
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo \
  uv run python scripts/verify_gamification.py
```

## 📋 What Gets Created

**What it does:**
- Creates 5 test users (`seed_user_01` through `seed_user_05`)
- Generates 14 days of historical activity data
- 70% chance each user practiced each day
- Random XP between 20-100 per session
- Automatically updates leaderboards and streaks
- **Idempotent**: Safe to run multiple times (skips existing users)

## 🧪 Testing Strategy

### A. Unit Tests

Test your gamification models and business logic:

```bash
# Run existing test file
python test_gamification.py
```

### B. Integration Testing

1. **Clean Database Test**
   ```bash
   # Drop and recreate tables (adjust based on your setup)
   # Then run seeding
   python scripts/seed_gamification.py
   python scripts/verify_gamification.py
   ```

2. **Idempotency Test**
   ```bash
   # Run seeding twice - should see "already exists" messages
   python scripts/seed_gamification.py
   python scripts/seed_gamification.py
   ```

3. **API Testing** (if you have endpoints)
   ```bash
   # Start your server
   uvicorn server.main:app --reload
   
   # Test endpoints with one of the seeded users
   # Example: GET /api/users/seed_user_01/gamification
   ```

### C. Database Inspection

Using `psql` or your preferred PostgreSQL client:

```sql
-- Check users
SELECT name, id FROM "user" WHERE name LIKE 'seed_user%';

-- Check daily progress
SELECT user_id, date_key, xp_earned, goal_met 
FROM daily_progress 
ORDER BY date_key DESC 
LIMIT 20;

-- Check leaderboard
SELECT u.name, l.period_key, l.total_xp 
FROM leaderboard_entry l
JOIN "user" u ON l.user_id = u.id
ORDER BY l.period_key DESC, l.total_xp DESC;

-- Check streaks
SELECT u.name, g.current_streak, g.last_activity_date
FROM user_gamification g
JOIN "user" u ON g.user_id = u.id;
```

## 🎓 Demo Script for Professor

### Option 1: Live Demo (Recommended)

**Step 1: Show Empty State**
```bash
# First verify database is empty (or show before state)
python scripts/verify_gamification.py
```

**Step 2: Run Seeding**
```bash
# Show the seeding script running with live output
python scripts/seed_gamification.py
```
✨ **Explain while it runs:**
- "Creating 5 test users with ULID primary keys"
- "Generating 14 days of historical data with 70% activity rate"
- "Each day randomly assigns 20-100 XP"
- "Automatically calculating streaks and leaderboard positions"

**Step 3: Show Results**
```bash
# Display comprehensive statistics
python scripts/verify_gamification.py
```
✨ **Highlight:**
- User streak calculations
- Daily progress patterns
- Leaderboard rankings
- Goal completion rates

### Option 2: Prepared Screenshots/Recording

If live demo isn't possible, capture:

1. **Terminal output** of `seed_gamification.py` showing:
   - User creation
   - Day-by-day XP generation
   - Success summary

2. **Terminal output** of `verify_gamification.py` showing:
   - User statistics with streaks
   - 14-day timeline visualization
   - Leaderboard rankings

3. **Database query results** showing actual table data

### Option 3: Jupyter Notebook Demo

Create `demo_gamification.ipynb`:

```python
import asyncio
from server.repository import Repository
# ... then show queries with visual output
```

## 🔧 Customization

Edit the constants in `seed_gamification.py`:

```python
SEED_USER_COUNT = 5          # Number of test users
HISTORY_DAYS = 14            # Days of historical data
PRACTICE_PROBABILITY = 0.7   # Chance user practiced (0.0-1.0)
MIN_XP = 20                  # Minimum XP per session
MAX_XP = 100                 # Maximum XP per session
GOAL_THRESHOLD = 40          # XP needed for goal_met=True
```

## ✅ Validation Checklist

Ensure your implementation is correct:

- [ ] Script runs without errors
- [ ] 5 users created with ULID IDs
- [ ] `daily_progress` table has ~50 records (5 users × 14 days × 70% ≈ 49)
- [ ] `leaderboard_entry` table has entries for current week
- [ ] `user_gamification` table has 5 profiles with streaks
- [ ] Running script twice doesn't create duplicates
- [ ] All foreign key relationships are valid
- [ ] Dates are in correct YYYY-MM-DD format
- [ ] Period keys follow WEEK-YYYY-WW format

## 🐛 Troubleshooting

### "Connection refused" or "Could not connect"
- Ensure PostgreSQL is running
- Check `DATABASE_URL` environment variable
- Verify database credentials

### "Table does not exist"
- Run migrations or ensure `Repository.create()` creates tables
- Check that gamification models are imported in `__init__.py`

### "Foreign key violation"
- Ensure User table exists before seeding
- Check ULID generation is working correctly

### ImportError
```bash
# Ensure you're in the server directory
cd server

# Install dependencies
pip install -r ../requirements.txt  # adjust path as needed
```

## 📚 Key Technical Details

### ULID Handling
```python
from ulid import ULID

# Generate new ID
user_id = ULID()

# Store in database (automatically converted to string by ULIDType)
user = User(id=user_id, ...)
```

### Date Key Format
- **Storage**: String `"YYYY-MM-DD"`
- **Usage**: `date.strftime("%Y-%m-%d")`
- **Composite Key**: `(user_id, date_key)` for `daily_progress`

### Period Key Format
- **Weekly**: `"WEEK-2024-05"` (ISO week number)
- **Calculation**: Uses `datetime.isocalendar()`

### Repository Pattern
```python
# Initialize (creates tables if needed)
repo = await Repository.create()

# Use session
async with repo.session() as session:
    # ... database operations
    await session.commit()

# Cleanup
await repo.dispose()
```

## 🎯 Success Criteria

Your professor should see:

1. ✅ **Professional code quality**: Clean, documented, error-handled
2. ✅ **Proper architecture**: Using Repository pattern, not manual engine creation
3. ✅ **Correct data types**: ULID for IDs, proper date formats
4. ✅ **Realistic data**: 70% activity rate, reasonable XP ranges
5. ✅ **Idempotency**: Safe to run multiple times
6. ✅ **Comprehensive output**: Clear logging and verification

Good luck with your demo! 🚀
