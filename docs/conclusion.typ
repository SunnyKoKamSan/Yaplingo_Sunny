= Conclusion

The development of this project has successfully demonstrated the integration of advanced ML pipelines, gamification mechanics, and real-time conversational interfaces to address a critical gap in language acquisition tools.
By leveraging phoneme-level analysis, large language models (LLMs), and a robust client-server architecture, the system provides learners with immersive, feedback-rich experiences that simulate real-world pronunciation practice.
The Echo Mode and Chat Mode, underpinned by a custom CTC forced alignment pipeline and WebSocket-driven state management, enable precise scoring and adaptive feedback, while gamification elements such as day streaks, XP accumulation, activity heatmaps, and global leaderboard foster sustained user engagement.
Deployed via Docker Compose with FastAPI, PostgreSQL, Redis, Taskiq, and a React Native frontend, the system exemplifies a scalable, production-ready solution for mobile pronunciation training.
This concluding chapter evaluates the project's constraints, outlines prospective improvements, and reflects on the academic and technical insights gained.

== Limitations <section:conclusion:limitations>

Despite its comprehensive implementation, the application exhibits several technical and operational limitations.

=== Prompt Injection in Chat Mode

Chat Mode is currently vulnerable to LLM prompt injection attacks, which is a well-documented security vulnerability in LLM-integrated systems whereby an adversary supplies carefully crafted inputs intended to override the model’s system prompt, alter its intended behaviour, or elicit unintended outputs.
In this use case, free-form user speech is captured and transcribed in real time by the Whisper ASR model, and concatenated directly into the conversation history that is subsequently passed to the LLM for reply generation and task-completion evaluation.
An attacker could therefore utter phrases deliberately engineered to produce, upon transcription, injection texts such as “Ignore all previous instructions and [malicious directive]”, thereby causing the LLM to bypass safety constraints, fabricate task completions, leak internal system prompts, or generate harmful content.
Because the server treats the transcribed user utterance as part of the authoritative context without intermediate sanitisation or isolation layers, such exploits could compromise session integrity, leaderboard fairness, and overall trustworthiness of the interactive learning experience.

=== Privacy Concerns

Since the system relies on remote LLM inference via Cloudflare Workers AI for all generative tasks in both Echo and Chat Modes, user pronunciation analysis results — phoneme-level alignment scores, Levenshtein distance metrics, task-completion evaluations, and transcribed speech contexts are forwarded to this third-party service provider.
Such external transmission raises significant data-sovereignty concerns, including potential retention policies, unauthorised access by the provider, or non-compliance with stringent data-protection frameworks such as GDPR, especially given the sensitive nature of learner-specific pronunciation weaknesses.
This limitation can possibly be eliminated by moving LLM inference to client-side, performing on-device LLM generation to ensure user data stays in their own devices.
Nevertheless, we are unable to ensure the computational resources on every user device are sufficient for the heavy LLM inference.
Therefore, all resource intensive operations are currently executed on server-side for simplicity to avoid complicating the pronunciation analysis process.

=== Formal Empirical Evaluation

The project lacks formal empirical evaluation, such as controlled user studies that would measure pronunciation improvement against established baselines or competing tools.
Without pre- and post-intervention assessments, statistical analysis of phoneme accuracy gains, or comparative experiments involving control groups, the educational impact remains inferred from technical metrics (e.g., difference in alignment confidence scores) rather than validated through quantitative learner outcomes.
This omission, while understandable given the time and resource constraints, restricts claims about the system’s efficacy in improving actual pronunciation skills, user retention, or long-term fluency gains.
The absence of such validation also limits the ability to identify unanticipated usability barriers or unintended pedagogical side-effects, thereby leaving the overall effectiveness of the AI-driven approach open to question.

== Improvements

Building upon the current foundation, several targeted enhancements could substantially elevate the application's pedagogical effectiveness, technical robustness, and global applicability.

=== Fluency Scoring

A primary improvement is the integration of fluency scoring.
Although the CTC forced alignment output already includes precise time intervals between aligned phonemes, the existing pipeline utilises only segmental pronunciation accuracy derived from Levenshtein distance, neglecting these prosodic dimensions.
Future development could extract and analyse these temporal features to compute comprehensive fluency metrics, including speaking rate (syllables per second), pause frequency and duration, and rhythm consistency.
Such metrics would enable holistic, multi-dimensional feedback that addresses both phonemic precision and suprasegmental fluency, thereby aligning more closely with real-world communicative competence.

=== Multilingual & Adaptive Accent Support

Extending multilingual and adaptive accent support would significantly broaden the application's international reach and pedagogical versatility.
Currently, the system is optimised exclusively for Standard American English.
Future iterations could accommodate additional English varieties (such as UK English) and entirely new languages (for example, German and Spanish) through straightforward substitution of the underlying Wav2Vec2 model checkpoint or variant readily available on the Hugging Face Hub.
Critically, the core pronunciation analysis pipeline would require minimal modification, as it already employs `phonemizer` (via eSpeak-NG) to generate universal IPA phoneme representations independent of language-specific orthographies.
Only the LLM system prompts would need updating to reflect new linguistic contexts and task-evaluation criteria, while both Kokoro TTS and Google TTS already provide native multi-language support for reference audio and feedback synthesis.
This reuse of the IPA-centric pipeline ensures efficient extensibility without wholesale redesign.

=== Custom Fine Tuned Model

The creation of a custom fine-tuned model based on the Wav2Vec2 architecture is beneficial.
By training an in-house variant on region-specific accent datasets (for example, corpora representing non-native English learners from diverse L1 backgrounds), the model could deliver markedly more accurate forced alignment and mispronunciation detection.
This targeted fine-tuning would overcome the generalisation limitations of publicly available pre-trained checkpoints, resulting in higher-confidence phoneme predictions tailored to the acoustic profiles of the application's primary user base.

== Reflection

Undertaking this project has been a transformative exercise in bridging theoretical knowledge with practical system design and engineering.
The requirement to orchestrate disparate components — from PyTorch-based pronunciation analysis pipelines and Whisper-based model inference to FastAPI WebSockets, Redis caching, and Expo-managed React Native client — demanded proficiency across full-stack development, machine-learning operations, and scalable real-time systems design.
Challenges such as debugging CTC alignment instabilities, optimizing LLM efficiency under resources constraints, and ensuring timezone-aware logic, honed practical problem-solving and debugging skills that extend far beyond classroom instruction.

The project underscored the interdisciplinary nature of modern AI applications, particularly in educational technology, where human-computer interaction, speech processing, and behavioral psychology converge.
The resulting prototype stands as a functional proof-of-concept that validates the viability of LLM-augmented pronunciation training.
Ultimately, this endeavor has equipped us with a deeper appreciation for ethical AI deployment, the iterative nature of software engineering, and the potential of technology to democratize language learning.
It serves as a solid foundation for future industry contributions in AI-driven technology, especially maintaining ML integrated systems.

#pagebreak()
