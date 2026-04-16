= Introduction

Pronunciation is widely recognised as one of the most challenging yet critical aspects of second-language acquisition. Accurate pronunciation directly influences intelligibility, listener comprehension, and overall communicative confidence. Despite decades of research highlighting its importance, traditional classroom instruction and most commercial language-learning applications continue to treat pronunciation as a secondary skill, often addressed through repetitive drills, native-speaker audio playback, or superficial speech-recognition feedback. Learners frequently report frustration with the lack of immediate, detailed, and personalised guidance that would enable them to identify and correct specific phoneme-level errors in realistic speaking contexts.

The rapid advancement of artificial intelligence — particularly in automatic speech recognition (ASR), phoneme modelling, and large language models (LLMs) — now makes it feasible to deliver high-quality pronunciation training that was previously available only through expensive human tutors. However, existing mobile applications still exhibit notable shortcomings. These gaps leave learners without a single, integrated solution that simultaneously delivers phoneme-precise assessment, contextual LLM-generated feedback, realistic conversational simulation, and comprehensive gamification.

This project addresses these deficiencies by designing and implementing a complete AI-driven mobile pronunciation learning application. The system combines advanced ML techniques for real-time audio analysis with engaging user-experience features to create an effective, motivating, and scalable learning tool. By focusing on both accuracy training and fluency in realistic scenarios, the application aims to bridge the divide between technical precision and sustained learner engagement.

== Existing Solutions

A review of existing pronunciation-focused language learning applications reveals significant gaps in the integration of advanced AI-driven feedback, immediate phoneme-level analysis, realistic conversational practice, and addictive gamification.
While several popular apps address aspects of pronunciation training, none fully combine these elements into a cohesive, engaging, and scalable system suitable for both beginner and advanced learners.

=== Duolingo <heading:unnumbered>

#figure(image("images/duolingo.png", width: 75%))

_Duolingo_ @duolingo remains one of the most popular language-learning platforms thanks to its highly engaging gamification elements.
However, its pronunciation feedback relies on relatively basic speech recognition that typically provides only pass/fail outcomes or generic corrections.
Even with recent AI enhancements (including AI chat in the premium tier), exercises remain largely predefined and repetitive, offering little support for advanced learners seeking nuanced phoneme improvement or spontaneous conversation practice.

=== ELSA Speak <heading:unnumbered>

#figure(image("images/elsaspeak.webp", width: 75%))

_ELSA Speak_ @elsaspeak specialises in pronunciation and delivers excellent real-time, detailed AI feedback on individual sounds, word stress, and fluency.
It includes role-play scenarios and an AI coach, yet it lacks the deep gamification mechanics—such as streaks, leaderboards, or social sharing features—that create long-term addictive engagement.
Users often report high initial progress but lower sustained motivation compared with fully gamified platforms.

=== Speechling <heading:unnumbered>

#figure(image("images/speechling.jpg", width: 75%))

_Speechling_ @speechling takes a human-centric approach, providing personalised feedback from certified coaches on pronunciation, intonation, and grammar.
While this delivers high-quality insights, the 24-hour turnaround time eliminates the immediacy that modern learners expect.
The absence of AI-driven instant feedback and strong gamification further limits its appeal for daily practice.

=== BoldVoice <heading:unnumbered>

_BoldVoice_ @boldvoice (formerly positioned as a vocabulary-level tool) has evolved into a dedicated American-accent trainer with strong AI phoneme-level analysis, video lessons from Hollywood coaches, and AI-powered role-play conversations.
It offers instant feedback and good progress tracking; however, its primary emphasis remains on isolated sounds, words, and short phrases rather than full-sentence fluency or the ability to recover from mispronunciation-induced misunderstandings in extended dialogue.

=== Babbel <heading:unnumbered>

#figure(image("images/babbel.png", width: 75%))

_Babbel_ @babbel emphasises practical, conversation-based lessons with native-speaker audio and the newer Babbel Speak AI feature for interactive speaking practice.
It provides solid speech recognition and immediate feedback within structured dialogues.
Nevertheless, its pronunciation tools are less granular than dedicated phoneme analysers, and the platform adopts a more traditional course structure with only moderate gamification, making it less effective for users who require intensive, scenario-driven pronunciation training.

== Problem Statement

The detailed examination of leading commercial applications reveals three fundamental and interrelated shortcomings that collectively hinder learner progress.

- *Feedback Quality & Immediacy*

Most mainstream apps rely on basic automatic speech recognition (ASR) that delivers only binary outcomes (“correct” / “incorrect”) or generic high-level suggestions such as “speak more clearly.” Very few operate at the fine-grained phoneme level or provide explicit explanations of specific articulation errors (e.g., distinguishing /θ/ from /s/ or misplaced word stress). Even dedicated pronunciation tools frequently stop at surface-level scoring without actionable, natural-language guidance.

- *Contextual & Realistic Practice*

Existing exercises are typically confined to isolated word or short-sentence repetition drills. Learners rarely encounter opportunities to improvise, handle interruptions, or recover from mispronunciation-induced misunderstandings—the exact skills required in spontaneous conversation. As a result, skills developed in the app transfer poorly to real-life scenarios where context, fluency, and adaptability matter more than perfect isolated pronunciation.

- *Long-Term Engagement*

While some platforms incorporate basic streaks or points, they lack the progressive difficulty, social proof, and addictive feedback loops (such as shareable activity heatmaps, global leaderboards, and XP as virtual currency) that have proven effective in driving daily habit formation in other domains. Consequently, initial enthusiasm often fades quickly, producing high churn rates and limited cumulative improvement.

== Project Objectives

The primary aim of the project was to develop a production-ready mobile application that significantly improves pronunciation learning outcomes.

1. To design and implement two complementary AI-powered learning modes — Echo Mode for intensive accuracy and fluency drills, and Chat Mode for realistic conversational practice — that together provide high-intensity pronunciation training across vocabulary and sentence levels.

2. To build a phoneme-level pronunciation analysis pipeline capable of preprocessing noisy user audio, recognising IPA phonemes with a fine-tuned model, quantifying errors via Levenshtein distance, and generating natural-language feedback with autoplay TTS, achieving end-to-end latency under seconds.

3. To incorporate a comprehensive gamification system — including daily streaks with dynamically increasing XP milestones, XP as virtual currency for hints, global leaderboards, and a shareable activity heatmap — to maximise long-term user retention and social motivation.

4. To architect a scalable, secure backend using layered separation of concerns, dedicated ML task queues, in-memory caching, WebSocket communication with server-as-single-source-of-truth, and Docker deployment, ensuring cheat resistance and production readiness.

== Project Scope

The project scope was deliberately focused to ensure depth and feasibility within the constraints of a bachelor final year project:

- *Target Language*: English (General American accent) for the minimum viable product.

- *Platform*: Cross-platform mobile application (iOS and Android) only; no web or desktop version.

- *Core Features*: Limited to Echo Mode, Chat Mode, and the defined gamification elements; additional features such as multi-language support, on-device inference, or RAG pipeline were deferred to future work.

Limitations accepted include reliance on cloud-based LLM and TTS services (introducing minor API latency and cost considerations) and the absence of formal large-scale longitudinal user studies due to time and participant constraints. These boundaries allowed full implementation and rigorous testing of the core AI and architectural innovations.

#pagebreak()
