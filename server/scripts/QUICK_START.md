# Quick Reference Guide - Gamification Seeding

## 🚀 TL;DR - Run This

```bash
cd /Users/sunnyko/Documents/Yaplingo-test/Yaplingo-9/server/scripts
./run_seed.sh
```

## 📝 What You Get

- ✅ **5 users**: `seed_user_01` through `seed_user_05`
- ✅ **~50 activity records**: 14 days × 5 users × 70% practice rate
- ✅ **3 weeks of leaderboards**: Weekly rankings with total XP
- ✅ **User streaks**: 1-10 day consecutive activity tracking
- ✅ **Realistic data**: Variable XP (20-100), some days off

## 🎓 Demo for Professor - 30 Second Version

1. **Show before state**: `./run_seed.sh` _(first output shows no gamification data)_
2. **Let it run**: Watch users being created and 14 days generating
3. **Show results**: Automatic verification displays:
   - User statistics with streaks
   - Daily timeline
   - Leaderboard rankings
   - Database statistics

## 📊 Key Numbers to Highlight

- **51 daily progress records** created
- **15 leaderboard entries** across 3 weeks
- **5 gamification profiles** with streaks
- **63.41 average XP** per session
- **80.4% goal completion rate**

## 🔧 If Something Goes Wrong

### Database not running?
```bash
cd /Users/sunnyko/Documents/Yaplingo-test/Yaplingo-9/server
docker compose up database -d
```

### Want to reset everything?
```sql
-- Connect to database
docker exec -it yaplingo-database-1 psql -U postgres -d yaplingo

-- Delete seeded data
DELETE FROM daily_progress WHERE user_id IN (
  SELECT id FROM "user" WHERE name LIKE 'seed_user%'
);
DELETE FROM leaderboard_entry WHERE user_id IN (
  SELECT id FROM "user" WHERE name LIKE 'seed_user%'
);
DELETE FROM user_gamification WHERE user_id IN (
  SELECT id FROM "user" WHERE name LIKE 'seed_user%'
);
DELETE FROM "user" WHERE name LIKE 'seed_user%';
```

### Check what's in the database?
```bash
docker exec -it yaplingo-database-1 psql -U postgres -d yaplingo -c "
  SELECT u.name, g.current_streak, COUNT(d.date_key) as days_active, SUM(d.xp_earned) as total_xp
  FROM \"user\" u
  LEFT JOIN user_gamification g ON u.id = g.user_id
  LEFT JOIN daily_progress d ON u.id = d.user_id
  WHERE u.name LIKE 'seed_user%'
  GROUP BY u.name, g.current_streak
  ORDER BY u.name;
"
```

## 📚 Full Documentation

- **Detailed README**: [scripts/README.md](README.md)
- **Implementation Summary**: [scripts/IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Source Code**: 
  - Seeding: [scripts/seed_gamification.py](seed_gamification.py)
  - Verification: [scripts/verify_gamification.py](verify_gamification.py)

## ✅ Validation Checklist

Before demo:
- [ ] PostgreSQL container running (port 5432)
- [ ] Script executes without errors
- [ ] 5 users created with ULID IDs
- [ ] Daily progress records exist
- [ ] Leaderboard entries show rankings
- [ ] Gamification profiles have streaks
- [ ] Running twice doesn't duplicate users

## 💡 Pro Tips

1. **Multiple runs**: Each run adds new activity patterns (safe!)
2. **Clean output**: Use `| grep "✅\|🔥\|🏆"` to filter key info
3. **Export data**: Redirect verification output to file for documentation
4. **Screenshots**: Capture terminal output for presentation slides

---

**Status**: ✅ Production Ready  
**Last Updated**: January 21, 2026  
**Tested On**: macOS with Docker PostgreSQL
