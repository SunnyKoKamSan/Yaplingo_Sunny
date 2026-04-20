#!/usr/bin/env python3
"""
Generate SQL seed data for Yaplingo demo.

Usage:
    python seed.py > seed.sql
    python seed.py | psql <database_url>

Produces INSERT statements for:
    - 10+ users with hashed passwords (argon2id)
    - 5–8 echo/chat sessions per user spread across different days
    - Achievements that match each user's points/streak
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from argon2 import PasswordHasher
from ulid import ULID

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

NUM_USERS = 12
MIN_SESSIONS_PER_USER = 5
MAX_SESSIONS_PER_USER = 8
DEFAULT_PASSWORD = "11111111"

LANGUAGES = ["en"]
TIMEZONES = [
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Australia/Sydney",
    "America/Sao_Paulo",
    "America/Chicago",
    "Pacific/Auckland",
]

USERNAMES = [
    "alice",
    "bob",
    "charlie",
    "diana",
    "ethan",
    "fiona",
    "george",
    "hannah",
    "ivan",
    "julia",
    "kai",
    "luna",
]

ECHO_TOPICS = [
    ("Ordering Coffee", "You walk into a cozy café and need to order your favorite drink."),
    ("Asking for Directions", "You are lost in a new city and need to find the nearest train station."),
    ("Self Introduction", "You are at a language exchange meetup and need to introduce yourself."),
    ("Buying Groceries", "You are at a local market and need to buy ingredients for dinner."),
    ("Booking a Hotel", "You call a hotel to book a room for the weekend."),
    ("At the Airport", "You need to check in and ask about your gate at the airport."),
    ("Restaurant Reservation", "You are calling a restaurant to make a reservation for tonight."),
    ("Weather Small Talk", "You are chatting with a neighbor about the weather forecast."),
    ("Returning an Item", "You need to return a defective item at a department store."),
    ("Pharmacy Visit", "You are at a pharmacy asking for over-the-counter medicine."),
]

ECHO_TRANSCRIPTS = [
    ["Can I get a large latte with oat milk please?", "Actually, make that iced. Thank you!"],
    ["Excuse me, could you tell me how to get to the train station?", "Is it within walking distance?"],
    ["Hi, my name is Alex. I'm learning this language for fun.", "I've been studying for about six months now."],
    ["I need two kilograms of tomatoes, please.", "Do you have any fresh basil?"],
    ["I'd like to book a double room for two nights, please.", "Does the room include breakfast?"],
    ["Where is gate B12?", "Is there a delay on flight 307?"],
    ["I'd like a table for four at seven o'clock tonight.", "Could we sit by the window?"],
    ["It looks like it might rain this afternoon.", "I heard the weekend should be sunny though."],
    ["I bought this blender last week and it stopped working.", "I have the receipt right here."],
    ["Do you have anything for a headache?", "Is this safe to take with other medication?"],
]

CHAT_SCENARIOS = [
    (
        "Hotel Check-in",
        "Good evening! Welcome to The Grand Hotel. Do you have a reservation?",
        ["Confirm your reservation", "Ask about breakfast hours", "Request a room with a view"],
    ),
    (
        "Doctor Appointment",
        "Hello, please take a seat. What brings you in today?",
        ["Describe your symptoms", "Ask about treatment options", "Schedule a follow-up"],
    ),
    (
        "Job Interview",
        "Thank you for coming in. Tell me a little about yourself.",
        ["Introduce your background", "Explain why you want this job", "Ask about the team"],
    ),
    (
        "Renting an Apartment",
        "Welcome! Let me show you around the apartment.",
        ["Ask about the lease terms", "Negotiate the rent", "Ask about nearby amenities"],
    ),
    (
        "Train Ticket Office",
        "Hello, how can I help you today?",
        ["Buy a round-trip ticket", "Ask about schedules", "Inquire about discounts"],
    ),
    (
        "Library Visit",
        "Good afternoon! Are you looking for something specific?",
        ["Ask for a book recommendation", "Get a library card", "Find the study room"],
    ),
    (
        "Car Rental",
        "Hi there, welcome to QuickRent. What can I do for you?",
        ["Reserve a compact car", "Ask about insurance", "Confirm the return policy"],
    ),
    (
        "Tech Support Call",
        "Thanks for calling TechHelp. What seems to be the issue?",
        ["Describe the problem", "Follow troubleshooting steps", "Request a replacement"],
    ),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

hasher = PasswordHasher()
password_hash = hasher.hash(DEFAULT_PASSWORD)

# Deterministic random for reproducibility
rng = random.Random(42)

# Base date: sessions span the last 30 days
NOW = datetime(2026, 4, 20, 12, 0, 0, tzinfo=timezone.utc)


def sql_str(s: str) -> str:
    """Escape a string for SQL single-quote literals."""
    return "'" + s.replace("'", "''") + "'"


def sql_ts(dt: datetime) -> str:
    return sql_str(dt.strftime("%Y-%m-%dT%H:%M:%S+00:00"))


def sql_array(items: list[str]) -> str:
    inner = ", ".join(sql_str(i) for i in items)
    return f"ARRAY[{inner}]"


def make_ulid(timestamp: datetime) -> str:
    """Generate a ULID with the given timestamp for time-ordering."""
    return str(ULID.from_datetime(timestamp))


class UserSeed(NamedTuple):
    id: str
    name: str
    password: str
    language: str
    timezone: str
    points: int
    gems: int
    streak_freezes: int
    streak: int
    streaked_at: datetime


# ---------------------------------------------------------------------------
# Generate data
# ---------------------------------------------------------------------------

users: list[UserSeed] = []
echo_rows: list[str] = []
chat_rows: list[str] = []
achievement_rows: list[str] = []

# Achievement thresholds for auto-claiming
POINTS_ACHIEVEMENTS = [
    ("first_step", 10, 5),
    ("bronze_mic", 500, 10),
    ("silver_mic", 2000, 25),
    ("gold_mic", 10000, 50),
]
STREAK_ACHIEVEMENTS = [
    ("streak_5", 5, 10),
    ("streak_14", 14, 25),
    ("streak_30", 30, 50),
]

for i in range(NUM_USERS):
    name = USERNAMES[i]
    lang = LANGUAGES[i % len(LANGUAGES)]
    tz = TIMEZONES[i % len(TIMEZONES)]

    num_sessions = rng.randint(MIN_SESSIONS_PER_USER, MAX_SESSIONS_PER_USER)

    # Pick random days in the last 30 days for sessions, sorted ascending
    day_offsets = sorted(rng.sample(range(1, 31), num_sessions))

    total_points = 0
    session_dates: list[datetime] = []

    for j, day_offset in enumerate(day_offsets):
        session_dt = NOW - timedelta(days=day_offset, hours=rng.randint(0, 12))
        session_dates.append(session_dt)

        is_echo = rng.random() < 0.55  # slight bias toward echo

        if is_echo:
            topic_idx = rng.randint(0, len(ECHO_TOPICS) - 1)
            topic, scenario = ECHO_TOPICS[topic_idx]
            transcripts = ECHO_TRANSCRIPTS[topic_idx]
            points = rng.randint(40, 120) * 100  # 4000–12000 range like formula
            total_points += points
            sid = make_ulid(session_dt)
            uid_placeholder = f"__USER_{i}__"

            echo_rows.append(
                f"  ({sql_str(sid)}, {sql_str(topic)}, {sql_str(scenario)}, "
                f"{points}, {sql_array(transcripts)}, {sql_ts(session_dt)}, {uid_placeholder})"
            )
        else:
            sc_idx = rng.randint(0, len(CHAT_SCENARIOS) - 1)
            scenario_name, opening, tasks = CHAT_SCENARIOS[sc_idx]
            points = rng.randint(50, 150) * 10  # 500–1500 range
            total_points += points
            sid = make_ulid(session_dt)
            uid_placeholder = f"__USER_{i}__"

            chat_rows.append(
                f"  ({sql_str(sid)}, {sql_str(scenario_name)}, {sql_str(opening)}, "
                f"{points}, {sql_array(tasks)}, {sql_ts(session_dt)}, {uid_placeholder})"
            )

    # Streak: pick a random current streak (some users active, some lapsed)
    streak = rng.choice([0, 0, 1, 2, 3, 5, 7, 8, 14, 21])
    if streak > 0:
        streaked_at = NOW - timedelta(days=rng.choice([0, 0, 0, 1]))  # mostly today
    else:
        streaked_at = datetime.min.replace(tzinfo=timezone.utc)

    gems = rng.randint(0, 500)
    streak_freezes = rng.randint(0, 3)

    user_id = make_ulid(NOW - timedelta(days=60 - i))  # stagger registration

    users.append(
        UserSeed(
            id=user_id,
            name=name,
            password=password_hash,
            language=lang,
            timezone=tz,
            points=total_points,
            gems=gems,
            streak_freezes=streak_freezes,
            streak=streak,
            streaked_at=streaked_at,
        )
    )

    # Achievements based on points
    earned_gems = 0
    for key, threshold, gem_reward in POINTS_ACHIEVEMENTS:
        if total_points >= threshold:
            claimed_dt = session_dates[min(len(session_dates) - 1, 1)]
            achievement_rows.append(f"  ({sql_str(key)}, {sql_ts(claimed_dt)}, {sql_str(user_id)})")
            earned_gems += gem_reward

    # Achievements based on streak
    for key, threshold, gem_reward in STREAK_ACHIEVEMENTS:
        if streak >= threshold:
            achievement_rows.append(
                f"  ({sql_str(key)}, {sql_ts(NOW - timedelta(days=streak - threshold))}, {sql_str(user_id)})"
            )
            earned_gems += gem_reward

    # Add earned gems to the user's gem total
    users[-1] = users[-1]._replace(gems=users[-1].gems + earned_gems)

# Replace user ID placeholders in session rows
for i, u in enumerate(users):
    placeholder = f"__USER_{i}__"
    replacement = sql_str(u.id)
    echo_rows = [r.replace(placeholder, replacement) for r in echo_rows]
    chat_rows = [r.replace(placeholder, replacement) for r in chat_rows]

# ---------------------------------------------------------------------------
# Output SQL
# ---------------------------------------------------------------------------

print("-- =============================================================================")
print("-- Yaplingo Seed Data (auto-generated)")
print(f"-- Generated: {NOW.isoformat()}")
print(f"-- Users: {len(users)}, Echo sessions: {len(echo_rows)}, Chat sessions: {len(chat_rows)}")
print(f"-- Default password for all users: {DEFAULT_PASSWORD}")
print("-- =============================================================================")
print()

# Users
print(
    'INSERT INTO "user" (id, name, password, language, timezone, points, gems, streak_freezes, streak, streaked_at) VALUES'
)
user_values = []
for u in users:
    user_values.append(
        f"  ({sql_str(u.id)}, {sql_str(u.name)}, {sql_str(u.password)}, "
        f"{sql_str(u.language)}, {sql_str(u.timezone)}, "
        f"{u.points}, {u.gems}, {u.streak_freezes}, {u.streak}, {sql_ts(u.streaked_at)})"
    )
print(",\n".join(user_values) + ";")
print()

# Echo Sessions
if echo_rows:
    print("INSERT INTO echo_session (id, topic, scenario, points, transcripts, completed_at, user_id) VALUES")
    print(",\n".join(echo_rows) + ";")
    print()

# Chat Sessions
if chat_rows:
    print("INSERT INTO chat_session (id, scenario, opening, points, tasks, completed_at, user_id) VALUES")
    print(",\n".join(chat_rows) + ";")
    print()

# Achievements
if achievement_rows:
    print("INSERT INTO user_achievement (key, claimed_at, user_id) VALUES")
    print(",\n".join(achievement_rows) + ";")
    print()

print("-- Done.")
