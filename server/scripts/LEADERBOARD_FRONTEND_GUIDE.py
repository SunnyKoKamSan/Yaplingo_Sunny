"""
Frontend Integration Guide: UTC-First Leaderboard
==================================================

This demonstrates how the frontend should call the new UTC-first leaderboard endpoint.
"""

# ============================================================================
# SCENARIO 1: Get Current Week Leaderboard (Recommended)
# ============================================================================

"""
JavaScript/TypeScript Example:
-------------------------------

async function getCurrentWeekLeaderboard() {
    // ✅ Simply call without parameters
    // Server automatically uses current UTC week
    const response = await fetch('/gamification/leaderboard');
    const leaderboard = await response.json();
    
    // Response: [
    //   { rank: 1, name: "seed_user_04", total_xp: 1599, user_id: "..." },
    //   { rank: 2, name: "seed_user_01", total_xp: 1296, user_id: "..." },
    //   ...
    // ]
    
    return leaderboard;
}
"""

"""
React Example with TypeScript:
-------------------------------

interface LeaderboardItem {
    rank: number;
    name: string;
    total_xp: number;
    user_id: string;
}

function LeaderboardWidget() {
    const [leaderboard, setLeaderboard] = React.useState<LeaderboardItem[]>([]);
    
    React.useEffect(() => {
        // ✅ No need to calculate week or timezone conversions
        // Server handles everything in UTC
        fetch('/gamification/leaderboard')
            .then(res => res.json())
            .then(data => setLeaderboard(data));
    }, []);
    
    return (
        <div>
            <h2>This Week's Top Players</h2>
            <ul>
                {leaderboard.map(item => (
                    <li key={item.user_id}>
                        #{item.rank} {item.name} - {item.total_xp} XP
                    </li>
                ))}
            </ul>
        </div>
    );
}
"""


# ============================================================================
# SCENARIO 2: Get Historical Week Leaderboard
# ============================================================================

"""
JavaScript/TypeScript Example:
-------------------------------

async function getHistoricalLeaderboard(weekKey: string) {
    // ✅ Pass specific period_key for historical data
    const response = await fetch(`/gamification/leaderboard?period_key=${weekKey}`);
    const leaderboard = await response.json();
    return leaderboard;
}

// Usage:
// getHistoricalLeaderboard("WEEK-2026-04");  // Previous week
// getHistoricalLeaderboard("WEEK-2026-03");  // Two weeks ago
"""


# ============================================================================
# KEY BENEFITS OF UTC-FIRST ARCHITECTURE
# ============================================================================

"""
1. **Global Consistency:**
   - User in Tokyo (UTC+9): Sees "WEEK-2026-05"
   - User in New York (UTC-5): Sees "WEEK-2026-05"
   - User in London (UTC+0): Sees "WEEK-2026-05"
   - All competing in the SAME leaderboard!

2. **No Client-Side Calculations:**
   - Frontend doesn't need to know ISO week logic
   - No timezone conversion bugs
   - Simpler frontend code

3. **Automatic Week Transitions:**
   - Server decides when "current week" changes
   - All users transition simultaneously (at UTC midnight)
   - No edge cases where users see different weeks

4. **Anti-Cheat Protection:**
   - Client can't manipulate which week they compete in
   - Server authority prevents exploitation
"""


# ============================================================================
# TESTING THE ENDPOINT
# ============================================================================

"""
cURL Examples:
--------------

# Get current week leaderboard:
curl http://localhost:8000/gamification/leaderboard

# Get specific historical week:
curl "http://localhost:8000/gamification/leaderboard?period_key=WEEK-2026-04"

Expected Response:
------------------
[
    {
        "rank": 1,
        "name": "seed_user_04",
        "total_xp": 1599,
        "user_id": "01KFG7M04YAD57029BC5G14V62"
    },
    {
        "rank": 2,
        "name": "seed_user_01",
        "total_xp": 1296,
        "user_id": "01KFG7M04NMNMRM3GTNQ8DME12"
    },
    ...
]
"""


# ============================================================================
# ADVANCED: Building a Week Selector
# ============================================================================

"""
React Example - Week History Selector:
---------------------------------------

function WeekSelector() {
    const [selectedWeek, setSelectedWeek] = React.useState<string | null>(null);
    const [leaderboard, setLeaderboard] = React.useState<LeaderboardItem[]>([]);
    
    React.useEffect(() => {
        const url = selectedWeek 
            ? `/gamification/leaderboard?period_key=${selectedWeek}`
            : '/gamification/leaderboard';  // Current week
            
        fetch(url)
            .then(res => res.json())
            .then(data => setLeaderboard(data));
    }, [selectedWeek]);
    
    return (
        <div>
            <select onChange={(e) => setSelectedWeek(e.target.value || null)}>
                <option value="">Current Week</option>
                <option value="WEEK-2026-04">Week 4 (Jan 20-26)</option>
                <option value="WEEK-2026-03">Week 3 (Jan 13-19)</option>
                <option value="WEEK-2026-02">Week 2 (Jan 6-12)</option>
            </select>
            
            <LeaderboardDisplay items={leaderboard} />
        </div>
    );
}
"""


# ============================================================================
# SUMMARY
# ============================================================================

"""
✅ Frontend Integration Checklist:
-----------------------------------
1. Call GET /gamification/leaderboard without parameters for current week
2. Add optional ?period_key=WEEK-YYYY-WW for historical data
3. Display rank, name, and total_xp from response
4. No timezone handling needed - server does everything in UTC
5. Test with users in different timezones to verify consistency

🔒 Security Benefits:
---------------------
- Server-side UTC authority prevents time manipulation
- Clients can't fake which week they're in
- Global fairness guaranteed

🚀 Performance:
---------------
- Query optimized with selectinload (no N+1 queries)
- Top 50 limit for efficient responses
- 2 total queries for full leaderboard with user names
"""
