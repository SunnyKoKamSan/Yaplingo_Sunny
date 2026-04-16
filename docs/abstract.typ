= Abstract <heading:unnumbered>

Pronunciation proficiency remains a critical yet underserved component of second-language acquisition, with existing mobile applications often failing to deliver immediate, accurate, and engaging feedback.
This project addresses these gaps by developing an AI-driven mobile application that integrates phoneme-level pronunciation analysis, large language model (LLM) feedback, and comprehensive gamification mechanism within a scalable and resilient architecture.

The system features two complementary learning modes: Echo Mode, which provides intensive accuracy and fluency training through user speech against LLM-generated scenario transcripts, and Chat Mode, which simulates real-life situation by having users engage in turn-based conversations with AI to accomplish LLM-defined tasks while handling potential misunderstandings caused by mispronunciation.

Pronunciation analysis is achieved via forced alignment with a fine-tuned Wav2Vec2 model outputting IPA phoneme tokens, preceded by DeepFilterNet noise reduction and PyTorch Audio voice-activity detection, with error quantification performed using Levenshtein distance.
Gamification elements — daily streaks with progressively increasing XP milestones, XP as virtual currency for hints, global leaderboards, and a shareable activity heatmap, drive long-term user retention.

This project is a combination of state-of-the-art speech AI with an intuitive mobile interface and gamification framework, demonstrating a complete, production-ready solution that outperforms existing tools in feedback immediacy, realism, and engagement.
Future extensions include multi-language support and offline inference capabilities.

#pagebreak()
