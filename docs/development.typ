= Development

== Division of Work

The development of this project was a collaborative effort that leveraged the strengths and expertise of each team member.
The work was divided into two main areas: machine learning integration, and gamification integration, both spanning across the development of backend and frontend components.

- The machine learning integration focused on implementing the core pronunciation analysis and feedback generation features, including the Echo Mode and Chat Mode functionalities, and user profile insights.
  This involved working with audio processing, ASR models, LLMs for text generation, and real-time communication via WebSocket API.

- The gamification integration focused on designing and implementing the day-streak system, XP mechanics, activity heatmap, and global leaderboard.
  This required careful consideration of user engagement strategies, data management for tracking user progress, and ensuring a seamless integration with the core application features.

While my teammate is responsible for the gamification integration, I am responsible for the machine learning integration in addition to designing the overall system architecture and laying the foundation for the application's core functionalities.
Regular communication and collaboration were maintained throughout the development process to ensure that both areas were aligned and integrated effectively.

== Timeline

The development of the AI-driven pronunciation learning application followed a structured, two-term timeline that aligned with the academic calendar.
An iterative approach was adopted, enabling continuous integration, testing, and refinement of features while maintaining focus on the core technical and user-experience objectives.

The timeline below summarises the key milestones achieved in each term.

=== Term 1 <heading:unnumbered>

- Planned the overall system design, including high-level architecture, technology stack selection, and major design decisions (e.g., layered backend structure, WebSocket communication, and task queue for ML inference).
- Implemented the foundational components of the system: PostgreSQL database schema, JWT authentication, Redis caching layer, Docker Compose environment, and the clean separation-of-concerns backend architecture.
- Developed a functional prototype of Echo Mode, including the initial pronunciation analysis pipeline (audio preprocessing, Wav2Vec2 phoneme recognition, LLM feedback generation, and Levenshtein-based phoneme scoring).

=== Term 2 <heading:unnumbered>

- Completed the full implementation of Echo Mode as production-ready: added autoplay TTS of feedback.
- Implemented the complete Chat Mode, integrating Whisper ASR, real-time turn-based conversation flow, task evaluation by LLM, and seamless WebSocket state management.
- Developed and integrated the full gamification system, comprising the day-streak mechanism (with dynamically increasing XP milestones), XP earning and spending logic, shareable activity heatmap, and global leaderboard.

#pagebreak()
