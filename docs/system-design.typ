= System Design

This chapter presents the system design of the AI-driven pronunciation learning mobile application.
The architecture is engineered to deliver responsive, interactive learning experiences while maintaining scalability, security, and computational efficiency for resource-intensive ML pipelines.
The design separates concerns into distinct layers — core ML processing, data persistence, caching and aggregation, and API orchestration — to provide real-time gamification, pronunciation analysis, and conversational practice to a React Native client.

== Core Features

The application implements three primary feature categories: gamification mechanics, Echo Mode for intensive pronunciation drills, and Chat Mode for contextual conversation practice.
Each feature is orchestrated through the backend to ensure the mobile client remains stateless and tamper-resistant.

=== Gamification

Gamification constitutes a central design pillar of the pronunciation learning application, strategically employed to enhance learner engagement, promote long-term retention of daily practice habits, and transform repetitive pronunciation drills into a motivating, goal-oriented experience.
Drawing on established principles of behavioural reinforcement and social comparison, the system incorporates four interconnected gamification components — experience points (XP), day streaks, activity heatmaps, and global leaderboards — that operate synergistically across both Echo Mode and Chat Mode sessions.
These elements not only reward immediate performance but also cultivate sustained user commitment by providing tangible progress indicators, competitive incentives, and public recognition.

- *Experience Points (XP)*

At the core of the gamification framework lies the XP system, which serves as the primary currency of achievement.
Users earn XP incrementally upon completion of learning sessions, with the precise amount calculated with a formula based on pronunciation accuracy and other factors specific to each mode.
In Echo Mode, XP reflects cumulative accuracy across all the transcripts.
In Chat Mode, it combines pronunciation quality and contextual metrics such as relevancy and appropriacy with successful fulfilment of conversational objectives.

Beyond its role as a performance metric, XP functions as virtual currency that users may expend to unlock contextual hints during active sessions, thereby introducing a deliberate trade-off between assistance and self-reliance that further reinforces strategic learning behaviours. Accumulated XP directly determines a user's position on the global leaderboard, enabling real-time social comparison and fostering a healthy competitive atmosphere among the learner community.

- *Day Streak*

Complementing XP accrual is the day-streak mechanism, engineered to incentivise consecutive daily participation.
A streak advances only when a user attains a predefined daily XP milestone, the value of which is dynamically computed through a progressive formula that escalates according to the current streak length and the ordinal day within the calendar month.

This adaptive thresholding ensures that maintaining longer streaks becomes increasingly challenging, thereby discouraging sporadic engagement while rewarding consistency.
The streak counter is prominently displayed in the mobile interface and reset upon failure to meet the daily threshold, providing immediate visual feedback that leverages loss-aversion psychology to sustain habitual practice.

#figure(
  image("images/duolingo-streak.png", width: 50%),
  caption: [_Duolingo_'s day streak feature],
)

- *Activity Heatmap*

To facilitate longitudinal self-monitoring and social sharing, the application renders an activity heatmap that visualises the number of completed sessions for every day of the calendar year.
Each cell is colour-coded by session volume, allowing users to discern usage patterns at a glance.
Beyond personal reflection, the heatmap is deliberately exposed to other registered users, enabling “social flexing” whereby learners may showcase sustained dedication and seasonal progress.
This transparency transforms private effort into a communal achievement, amplifying motivational effects through observational learning and peer recognition.

#figure(
  image("images/github-heatmap.png"),
  caption: [_GitHub_'s contribution graph, which is a heatmap for similar purpose.],
)

- *Global Leaderboard*

The global leaderboard aggregates total XP across all users to produce a ranked listing that updates in near real time. Leaderboard visibility is tiered — users may view their relative standing, top percentiles, and selected peers — thus balancing individual aspiration with community-wide competition.

#v(.5em)

Collectively, these gamification features elevate the application from a purely instructional tool to an immersive learning ecosystem.
By quantifying pronunciation improvement through XP, reinforcing daily discipline via adaptive streaks, enabling visual progress archiving through heatmaps, and stimulating extrinsic motivation through public rankings, the design fosters intrinsic engagement while aligning user behaviour with the pedagogical goal of habitual, high-intensity pronunciation practice.
The seamless integration of these elements with the Echo and Chat Modes ensures that every interaction simultaneously advances linguistic proficiency and gamified achievement, thereby maximising both educational efficacy and user retention.

=== Echo Mode

Echo Mode constitutes the primary mechanism for deliberate, high-intensity pronunciation practice within the application.
Designed to target both segmental accuracy (individual phonemes and words) and suprasegmental fluency (prosody and sentence-level flow), the mode immerses users in repetitive yet varied drills that simulate focused auditory-motor training.

Upon session initiation, the system first establishes a contextual scenario generated based on a randomly selected topic (food, culture, travel, business) — such as ordering food in a restaurant, participating in a job interview, or visiting a local farmers market.
For the generated scenario, the LLM then produces five semantically coherent yet phonetically distinct transcripts.
These transcripts serve as the target utterances the user must attempt to reproduce by speaking.

The interaction proceeds in a structured, round-based sequence.
For each of the five transcripts, the client presents the written text on screen with its phoneme representation, while providing a reference pronunciation through high-fidelity TTS synthesis optimised for phonetic clarity.
The user then records their spoken attempt in a guided audio-capture interface.

Immediately upon submission, the backend performs phoneme-level pronunciation analysis on the recorded audio, comparing the user's phoneme sequence against the canonical phoneme representation of the reference transcript.
A quantitative alignment-confidence score is computed for each transcript, reflecting the degree of phonetic match.
This score contributes directly to the session's overall XP allocation, with the final XP gain calculated as the arithmetic sum across all five transcripts.

Following scoring, the system generates concise, user-friendly textual feedback via LLM that explicitly identifies phoneme-level discrepancies (substitutions/insertions/deletions relative to the target).
To maximise engagement and reinforce auditory learning, this feedback is automatically converted to speech via a natural-sounding TTS engine and played back to the user without requiring additional input.

#figure(
  image("images/echo-flow.png"),
  caption: [session flow of Echo Mode],
) <image:echo-flow>

The combination of visual text, reference audio, user recording, scored result, and spoken feedback creates a tight perceptual loop that promotes rapid error correction.
By constraining each round to exactly five transcripts per scenario, Echo Mode balances depth with manageability, allowing users to achieve measurable improvement within short daily sessions while accumulating XP toward gamification milestones.
The mode's emphasis on controlled repetition distinguishes it from more open-ended conversational practice, making it particularly effective for building foundational pronunciation accuracy before learners progress to the improvisational demands of Chat Mode.
Consequently, Echo Mode serves as both a scaffold for novice users and a precision-training tool for intermediate and advanced learners seeking to refine specific phonetic challenges.

=== Chat Mode

Chat Mode represents the application's flagship feature for contextualised, conversational pronunciation practice, designed to transition learners from isolated drills to fluid, real-world language use.
Unlike the more prescriptive structure of Echo Mode, Chat Mode immerses the user in a dynamic, turn-based dialogue with an AI interlocutor, thereby cultivating both pronunciation accuracy and pragmatic competence under conditions that closely approximate authentic communicative scenarios.

Additionally, the interaction unfolds as a strictly turn-based conversation governed by a predefined limit on the total number of user replies.
This constraint heightens the challenge by simulating time-pressured real-life exchanges and compels learners to formulate more concise, purposeful responses while still addressing all assigned tasks.

The session commences with the LLM generating a coherent conversational context. This includes (i) a realistic scenario (e.g., ordering food at a restaurant, negotiating a business meeting, or seeking medical advice), (ii) a set of explicit communicative tasks that the user must accomplish within the dialogue (e.g., “confirm the reservation time,” “inquire about dietary options,” or “express uncertainty politely”), and (iii) an opening utterance delivered to the user. Upon receiving the scenario and opening line, the user responds verbally by speaking to advance the conversation.

Each user utterance undergoes the ASR model which transcribes the spoken input to enable contextual understanding.
Concurrently, it undergoes the same phoneme-level pronunciation analysis employed in Echo Mode, yielding a  alignment-confidence score.
The LLM then performs three concurrent operations: (a) evaluates whether the user has completed the predefined tasks with corresponding textual explanation, (b) generates a contextually appropriate next reply that maintains conversational coherence and advances the scenario, and (c) computes an overall contextual score that reflects both linguistic accuracy and pragmatic effectiveness.
The AI's reply is immediately synthesised via a natural-sounding TTS engine and auto-played to the user, preserving the immediacy and interactivity of a genuine exchange.

Scoring in Chat Mode is multifaceted and directly tied to gamification objectives. XP awarded per turn comprise the sum of (i) the pronunciation alignment-confidence score for the user's utterance and (ii) a task-completion bonus determined by the number of communicative objectives met. This dual scoring mechanism incentivises not only phonetic precision but also strategic improvisation — users learn to recover from misunderstandings that may arise precisely because of mispronunciation, mirroring challenges encountered in real-life interactions.

#figure(
  image("images/chat-flow.png"),
  caption: [session flow of Chat Mode],
) <image:chat-flow>

By simulating open-ended dialogue, Chat Mode addresses a critical gap in traditional pronunciation training: the development of fluency under unpredictable conditions.
Learners must adapt their pronunciation on the fly, monitor listener comprehension through the AI's responses, and employ repair strategies when phonological deviations impede mutual understanding.
Additionally, by restricting the conversation length, Chat Mode also encourages strategic language use, prioritises clarity under constraint, and reinforces the practical consequences of mispronunciation in authentic settings.
The mode thus bridges controlled, accuracy-focused practice (Echo Mode) and spontaneous, goal-oriented communication, fostering both micro-level phonetic improvement and macro-level conversational resilience.

== System Architecture

The backend of the application is architected as a modular, event-driven system that ensures responsive real-time interactions, efficient handling of compute-intensive tasks, and reliable persistence of user progress data and completed session data.
The design comprises four core components — API Server, Task Queue with Workers, In-Memory Key-Value Store, and Persistent Database — that interact through clearly defined asynchronous and synchronous interfaces.
This separation of concerns enables the system to scale horizontally while maintaining low latency for mobile clients and high throughput for ML operations.
A conceptual overview of the architecture is illustrated in @image:architecture, which depicts the primary data flows and component interdependencies.

#figure(
  image("images/architecture.png", width: 75%),
  caption: [overview of the backend architecture],
) <image:architecture>

=== Server

The server functions as the central orchestration layer and the sole entry point for the mobile client.
It exposes RESTful endpoints for authentication, user profile management, and gamification queries (such as user login/registration, leaderboard retrieval and streak updates).
For the interactive Echo Mode and Chat Mode, the server maintains persistent WebSocket connections that serve as the primary communication channel, managing the flow of the learning session.
Acting as the single source of truth for all session state, the server enforces business rules, validates inputs, and broadcasts incremental updates to the client after each interaction round.
This “dumb-client” model prevents any client-side manipulation and guarantees consistency across devices.

=== Database

The database serves as the authoritative repository for all durable state within the system, ensuring long-term data integrity and supporting the full spectrum of gamification and learning features.
It securely maintains comprehensive user profiles, including account details and preferences; granular historical records of completed sessions, including every phoneme score; progressive tracking of day streaks and total XP accumulations.
Particularly, using a relational database allows simpler data aggregation by joining tables of different entities for retrieving a large amount of data at once, suitable for use cases like querying all completed sessions of a user, and summing up total points earned by a user in a period of time.

=== Store

An in-memory key-value store serves as the high-speed intermediary for transient and frequently accessed data.
It also acts as the results backend for the task queue, enabling non-blocking retrieval of analysis outcomes with sub-millisecond latency.
In addition, it caches aggregated gamification metrics — such as real-time leaderboard snapshots, daily XP accumulations, and activity heatmap buffers — thereby reducing load on the persistent storage layer.
Metadata of in-progress sessions, including current turn counters, partial XP accumulations, and reconnection states for interrupted WebSocket sessions, are also maintained here to support seamless continuity and multi-device usage.

Notably, in-progress sessions are considered ephemeral, meaning that they only exist as expirable states in the store, and are not actually recorded in the database until they are fully completed.
Sessions aborted halfway are forgotten and deleted from the store, leaving no records in the system.
This model allows the system to manage data more efficiently by ensuring no persisted data records are in partial state.

=== Task Queue

Computationally demanding operations, particularly the end-to-end pronunciation analysis pipeline (audio pre-processing, ASR model inference, forced alignment, and LLM inference), are deliberately decoupled from the server through a task queue (and workers) service.
When a user submits an audio utterance during a learning session, the server packages the request as a task and enqueues it for asynchronous execution.
Dedicated worker processes consume these tasks, perform the required inference, and return the results (phoneme alignments, transcripts, and feedback) to a shared result backend (the store).
This offloading mechanism ensures that the server remains responsive even under concurrent load from multiple active sessions.

== Major Architectural Choices

The system design incorporates several deliberate architectural decisions to balance the competing demands of real-time interactivity, computational efficiency, data consistency, and scalability in an AI-driven pronunciation learning mobile application.
These choices were guided by the need to deliver responsive conversational experiences while isolating resource-intensive ML workloads and preserving the integrity of gamification elements.
The subsections below detail the rationale, benefits, and trade-offs of the three principal decisions.

=== Dedicated Task Queue

#figure(
  image("images/task-queue.png", width: 30%),
  caption: [data flow of the task queue],
)

Separating the pronunciation-analysis pipeline into a dedicated task queue and worker processes was a foundational choice to prevent compute-bound operations from degrading the overall responsiveness of the application.
All ML tasks, including noise reduction, forced alignment via ASR model, STT transcription, TTS synthesis, and feedback generation and evaluation via LLM, require sustained CPU and memory resources that can extend to several seconds per utterance.
Executing these tasks synchronously within the server would introduce unacceptable latency for concurrent WebSocket clients and REST requests, particularly during peak usage when multiple users engage in Echo or Chat sessions simultaneously.
By offloading inference to asynchronous workers in separate processes, the server remains lightweight and focused exclusively on orchestration, request validation, and state management.
This decoupling also enhances horizontal scalability: additional worker instances can be provisioned independently of the web tier without altering session-handling logic, thereby accommodating future growth in usage volume.
Moreover, the task queue model improves fault isolation; transient failures in ML execution can be retried or logged without interrupting active user sessions.
Consequently, the architecture maintains the low-latency, engaging experience essential for pronunciation training while preserving clean separation of concerns between interactive orchestration and heavy computational workloads.

=== Intermediary Store

The integration of an in-memory key-value store as a central intermediary layer was selected to address the stringent performance requirements of real-time session management and frequently accessed gamification aggregates.
During Echo and Chat sessions, intermediate results — such as phoneme scores, partial XP accumulations, turn counters, and session metadata — must be retrieved and updated with sub-millisecond latency to sustain conversational flow.
Similarly, aggregated queries such as leaderboard rankings, daily XP milestones, and activity heatmap buffers involve high-frequency read operations and occasional writes that would otherwise impose prohibitive load on the database.
By serving as both the result backend for the task queue and a high-speed cache for these transient and aggregated datasets, the in-memory store eliminates repeated disk-bound queries, enabling near-instantaneous session state synchronisation across clients.
Its configurable persistence and time-to-live mechanisms further allow selective durability for critical short-lived data while keeping volatile session information lightweight.
Additionally, the built-in data structures it provides allows more efficient operations on tracking gamification elements including daily XP accumulation and global leaderboard.
This hybrid storage approach therefore strikes an optimal balance between the strong consistency guarantees of the relational database and the speed and scalability demanded by an engaging, always-connected mobile learning experience.

=== WebSocket API

The adoption of a WebSocket API exclusively for Echo and Chat Mode interactions was driven by the necessity for persistent, bidirectional, and low-latency communication in dynamic pronunciation drills.

Traditional RESTful endpoints, reliant on repeated client-initiated polling or separate request-response cycles, would introduce noticeable delays between each user utterance and the subsequent AI feedback or next-turn prompt.
It also requires client-side state management for the session, which may unexpectedly become out of sync with the authentic server-side session state.
Additionally, implementing these modes of complex state flow with RESTful endpoints would require exposing multiple endpoints, each for updating a specific state while requiring different state validations, leading to an undesirably huge API surface to maintain.

In contrast, WebSockets establish a single, full-duplex channel that remains open for the duration of the session, allowing the server to push incremental session updates — including pronunciation analysis results, textual and audio feedback, task evaluations, and the next AI response — immediately upon state changes, while keeping the authentic session state on server-side exclusively.

Overall, this choice delivers the fluid, real-time interactivity required to implement engaging learning sessions and simulate authentic spoken exchanges, which would be otherwise difficult to achieve with traditional RESTful endpoints.

#pagebreak()
