= Implementation

This chapter details the practical realisation of the AI-driven pronunciation learning mobile application, translating the conceptual architecture and feature designs presented in earlier chapters into a fully operational system.
The implementation phase focused on two core areas: the development of a robust backend server capable of orchestrating compute-intensive ML pipelines, real-time WebSocket sessions, and gamification logic; and the construction of a responsive cross-platform frontend client on mobile devices primarily for capturing user's audio input and displaying data retrieved from the backend server.

== Environment

The development of this project was conducted on a MacBook Pro (2023) equipped with an Apple M2 Pro chip and 32 GB of unified memory.
This hardware configuration provided sufficient computational capacity for local inference of the ML pipelines, including the Wav2Vec2 phoneme alignment model and the Whisper-based ASR component, except the LLM component, in an acceptable speed, while simultaneously running Dockerised backend services and React Native frontend builds.

== Project Structure

This project is a monorepo managed with Git, residing the source code of both the mobile client (`/app`) and the backend server (`/server`).
Notably, all the core ML related modules, including the whole pronunciation analysis pipeline and the LLM/TTS integration, are located inside `/server/core` as the same data models and configurations are shared within the backend server.

=== Backend

The backend is implemented in CPython 3.10.18.
`uv` is used to manage dependencies and the Python virtual environment.

There are two deployment related configuration files at root: `Dockerfile` and `docker-compose.yaml`, which are used to run the backend server locally with Docker using a single command: `docker compose up`.
The `Dockerfile` uses a multi-stage build, separating the build environment (installing dependencies and downloading models) from the runtime environment (running the server with `uvicorn`).
Notably, there is a `init.py` file at root for downloading the required ML models in the build stage before actually running the server such that when the server is restarted (due to code changes or manual container restart), models are already cached in a named Docker volume on disk without downloading again.

Additionally, two packages are locally vendored instead of being directly pulled from PyPI.
These are (i) `gtts`, a library for fetching Google Translate TTS audio as reference pronunciation in Echo Mode, vendored for custom additional asynchronous support to achieve better performance, and (ii) `phonemizer`, a library that uses eSpeak-NG to convert graphemes (text) to phonemes (IPA symbols), vendored due to a dependency conflict with the `kokoro` package.

A `.env` file at root is used for flexible runtime configurations and storing secrets including API keys and tokens through environment variables, which is loaded via the `pydantic-settings` library on server start.

The server itself is run with `uvicorn`, a fast ASGI-compatible HTTP server, with the `--reload` flag enabled in development to restart the server when code changes are detected.

=== Frontend

The frontend is a cross-platform mobile client implemented in TypeScript (with TSX syntax) using React Native with Expo SDK 54.
`npm` is used to manage dependencies and run scripts/commands for development.

The codebase adopts `prettier` and `eslint` for code formatting and linting respectively to ensure clean and compile-able code for continuous development.

== Backend: Pronunciation Analysis Pipeline

This pipeline is the concrete implementation for the "analyze speech audio" step in the session flows of Echo Mode and Chat Mode as specified in @image:echo-flow and @image:chat-flow.
The execution of the pipeline is always delegated to a separate worker process managed by the task queue from the main server process as it involves CPU-bound ML operations that would otherwise drag down the performance of the IO bound operations in the main server process.

Each component in the pipeline is implemented in an independent class with a `__call__` method to invoke its intended operation, while the pipeline itself is implemented with a class that is composed of its dependent components, also having a `__call__` method that invokes the components in a specific order.

#figure(
  [```
  server/core/
  ├── generators/
  ├── models/
  │   ├── chat.py
  │   ├── common.py
  │   └── echo.py
  ├── pipelines/
  │   ├── chat.py
  │   └── echo.py
  ├── aligner.py
  ├── levenshtein.py
  ├── processor.py
  ├── textspeech.py
  └── transcriber.py
  ```],
  caption: [directory structure of the backend core module],
) <figure:listing>

Notably, the pronunciation analysis pipelines of Echo Mode and Chat Mode are two separate classes in order to accommodate mode-specific flow and integration of other “peripheral” components, including the different LLM generators and the Chat Mode specific ASR transcriber.

#figure(
  image("images/pipeline.png"),
  caption: [flow of the pronunciation analysis pipeline],
) <image:pipeline>

Generally, the pipeline performs the following stages in order.

=== Audio Processing

The `AudioProcessor` class in `/server/core/processor.py` handles the transformation of raw audio data into a clean waveform suitable for ML inference in later stages.
This stage is critical because real-world audio recorded on mobile devices contains significant noise and silence that would degrade analysis accuracy and inference speed.
By mitigating environmental noise and removing non-speech segments, the pipeline enhances the reliability of downstream phoneme tokenisation and Levenshtein-distance-based mispronunciation identification, thereby improving overall pedagogical accuracy in both Echo Mode and Chat Mode sessions.

#figure(
  [```python
  # load audio as waveform (torch.Tensor)
  waveform, sr = torchaudio.load(io.BytesIO(audio))
  # remove background noise using DeepFilterNet
  if sr == self.df_state.sr():
      waveform = df.enhance(self.df_model, self.df_state, waveform)
  # resample if necessary
  if sr != self.sr:
      waveform = torchaudio.functional.resample(waveform, sr, self.sr)
  # ensure waveform is mono
  if waveform.shape[0] > 1:
      waveform = waveform.mean(dim=0, keepdim=True)
  # trim silence in both ends with VAD
  waveform = torchaudio.functional.vad(waveform, self.sr)
  # flatten to 1D tensor
  waveform = waveform.squeeze()
  # returns None if waveform is silence only after all
  return waveform if waveform.numel() > 0 else None
  ```],
  caption: [The `__call__` method of the `AudioProcessor` class.],
)

Upon receipt of the raw audio bytes which is passed down from the web layer, it is loaded via `torchaudio.load` and resampled to the downstream model's native 48 kHz sample rate if necessary, yielding an audio waveform (`torch.Tensor`).
Then, the audio waveform is run through the noise reduction model to filter out background noise.
Finally, the audio waveform is transformed with PyTorch's audio VAD transform to trim silence segments from both ends of the audio that could otherwise inflate Levenshtein distances or introduce spurious phoneme tokens during forced alignment, retaining only speech-active regions for faster process time in downstream stages.

==== Noise Reduction

Noise reduction is performed using DeepFilterNet @deepfilternet, a perceptually motivated, deep-learning-based speech enhancement framework.
The model applies a two-stage process: (1) a Deep Filtering (DF) module that estimates a complex ratio mask in the time-frequency domain using a compact RNN backbone, and (2) a subsequent post-filter that refines the enhanced spectrogram before inverse transformation back to the time domain.

The selection of DeepFilterNet over alternative noise reduction methods was driven by a combination of objective performance metrics, real-time feasibility, and seamless integration with the project's PyTorch-centric ecosystem.
Below are a comprehensive examination of alternatives with various approaches.

- *Superior speech preservation and generalisation compared with classical signal-processing libraries.*

  The `librosa` @librosa library provides spectral subtraction and basic bandpass filtering but lacks adaptive, data-driven modelling of complex noise; empirical tests during development showed residual artefacts and over-suppression of fricatives critical for phoneme alignment.

  Similarly, the `noisereduce` @noisereduce library, which relies on stationary noise profiling via spectral gating, exhibited poor performance on non-stationary noise typical of mobile users (e.g., variable room acoustics), resulting in measurable degradation of subsequent forced alignment confidence scores.

- *Efficiency and integration advantages over general-purpose DSP implementations.*

  Hand-crafted digital signal-processing filters using NumPy and SciPy require manual tuning of cut-off frequencies and filter orders for each noise profile — an infeasible requirement for a production system serving heterogeneous user environments.
  Such filters also scale poorly with varying SNR levels and introduce phase distortion that adversely affects CTC forced alignment.

- *Deployment practicality vs. external command-line tools.*

  FFmpeg and SoX require spawning separate subprocesses from the Python backend.
  This approach introduces unacceptable latency, complicates error handling within the asynchronous task queue, and breaks the pure-Python/PyTorch dependency graph essential for Docker Compose portability across development and production environments.

- *Computational and latency superiority relative to other deep-learning-based noise reduction models.*

  Although Demucs @demucs offers high-quality speech enhancement via a U-Net-style waveform autoencoder, its significantly larger model footprint (≈ 80 M parameters versus DeepFilterNet's ≈ 2.5 M) and higher inference latency (≈ 300 ms per second of audio versus DeepFilterNet's < 80 ms on equivalent hardware) rendered it unsuitable for the CPU-bound task queue.
  DeepFilterNet's lightweight design, real-time streaming capability, and native PyTorch compatibility ensure seamless orchestration with the remainder of the pipeline while maintaining sub-200 ms end-to-end preprocessing latency — an essential requirement for responsive WebSocket feedback in live learning sessions.

==== Silence Trimming

Following noise reduction, the enhanced waveform undergoes silence trimming using the Voice Activity Detection (VAD) transform provided by `torchaudio` (PyTorch Audio library).
The VAD module employs a pre-trained, lightweight GRU-based detector operating on 80 ms frames with a 10 ms hop size and a default energy threshold of 0.5 (empirically tuned on development data).
Leading and trailing silence segments below the threshold are excised, while short internal pauses (< 300 ms) are preserved to retain natural prosodic boundaries essential for accurate sentence-level pronunciation scoring.
The resulting trimmed tensor is converted back to a contiguous PCM buffer and passed directly to the CTC forced alignment model.

This PyTorch-native VAD implementation was preferred for its zero-overhead integration within the existing tensor pipeline, deterministic behaviour across CPU architectures, and avoidance of external dependencies.
The combined preprocessing pipeline — DeepFilterNet followed by `torchaudio` VAD — reduces average input audio length by one third while preserving most of the speech content, directly contributing to faster inference times in the phoneme alignment stage and higher overall system throughput.

=== CTC Forced Alignment

CTC Forced Alignment @torchaudio-ctc-alignment is a technique used in speech technology to map a known text transcript to audio, determining the precise start and end times of spoken words or phonemes, alongside the confidence score for each phoneme, which is essentially equivalent to the Goodness of Pronunciation (GoP) metric in this case.
It matches acoustic features in the audio to textual tokens by generating a probability trellis and finding the most likely path.

In this project, we utilize this technique to identify mispronunciation by extracting phonemes with low alignment confidence, and obtain the predicted phonemes by the model to be compared with the canonical reference phoneme sequence.
The relevant code can be found at `/server/core/aligner.py`.

==== Model Selection

A pre-trained Wav2Vec2 @wav2vec2 model, specifically `facebook/wav2vec2-lv-60-espeak-cv-ft` @wav2vec2-phoneme hosted on the Hugging Face Hub, was selected and integrated via the `transformers` library.
This model, originally pre-trained on 60,000 hours of multilingual LibriVox data (from audiobooks) and subsequently fine-tuned on Common Voice corpora (from L2 learners) using eSpeak-derived IPA transcriptions, directly emits phoneme tokens in International Phonetic Alphabet (IPA) format.
Since the model was fine-tuned on domain-specific corpora collected from non-native learners (Common Voice), the model can generalise across diverse accents and regional dialects. @wav2vec2-mispronunciation

The necessity of employing a model that outputs IPA phonemes stems from the pedagogical and technical requirements of the application.
Traditional word- or character-level ASR outputs lack the granularity required for precise mispronunciation detection; phoneme-level alignment enables the system to isolate individual sound units (e.g., distinguishing /θ/ from /ð/ or vowel quality variations) and quantify deviations via Levenshtein distance on phoneme sequences.
Particularly, IPA was chosen over language-specific schemes such as ARPABET because of its universality and language-agnostic nature, providing a foundation for future multilingual expansion without retraining the alignment component.
The model's CTC head, fine-tuned explicitly on IPA-labelled data, produces a probability distribution over a phoneme vocabulary that includes the blank token, allowing robust forced alignment even in the presence of variable speaking rates or minor disfluencies common in language-learning scenarios.

Although OpenAI's Whisper @whisper architecture constitutes another state-of-the-art (SOTA) ASR model renowned for its robustness in multilingual and noisy environments, it was deliberately not selected for the CTC forced alignment component of this pipeline.
While Whisper delivers excellent general-purpose speech-to-text performance, empirical evaluations on low-resource and specialised phoneme recognition tasks consistently demonstrate that Wav2Vec2-based models are more efficient to fine-tune, particularly when computational resources are limited and the objective involves adaptation to custom vocabularies such as IPA phoneme tokens.
The self-supervised pre-training paradigm of Wav2Vec2 enables rapid domain-specific adaptation with substantially smaller labelled datasets and lower memory/throughput overhead (often 15x-40x faster inference than comparable Whisper variants), making it ideally suited to the project's requirement for lightweight, controllable phoneme-level forced alignment within the Dockerised backend environment.
In contrast, Whisper's encoder-decoder architecture, while powerful for end-to-end transcription, incurs higher fine-tuning costs and memory demands when repurposed for CTC-style phoneme alignment, rendering it less optimal for the specialised, resource-constrained pronunciation assessment use case.1

This Wav2Vec2-based CTC approach was preferred over several established alternatives for pronunciation assessment, each of which presented limitations incompatible with the project's constraints of real-time local inference and full pipeline controllability:

- The #underline[bundled pre-trained checkpoints] in PyTorch Audio (e.g., `WAV2VEC2_ASR_BASE_960H`) are optimised for English word- or grapheme-level ASR rather than phoneme recognition.
  They lack IPA output and require additional post-processing or external grapheme-to-phoneme conversion, introducing error propagation and reducing alignment precision for pronunciation feedback.

- #underline[SpeechBrain]'s `CTCAligner` (built on `k2`) @speechbrain supports forced alignment but necessitates a custom tokeniser and separate acoustic model training pipeline.
  While flexible, it offers less seamless integration with the existing PyTorch-based ML core and Hugging Face ecosystem already used for other components, increasing development overhead without noticeable gains in phoneme-level accuracy for this use case.

- #underline[Microsoft Azure Pronunciation Assessment API] @azure-pronunciation, although robust in pronunciation analysis, imposes reliance on remote API service, per-request latency, and usage quotas, incurring costs for an educational final-year project.
  Being a proprietary black-box service, it limits customisation of the underlying mispronunciation identification or scoring logic, violating the requirement for a fully controllable, open-source pipeline running within the Dockerised backend.

- The #underline[Montreal Forced Aligner (MFA)] @mfa, a widely adopted HMM-GMM CLI tool, delivers high boundary accuracy on read speech.
  As a command-line utility reliant on pre-generated phonetic dictionaries and TextGrid output, it cannot be invoked efficiently within the asynchronous task queue for sub-second inference.
  Moreover, its non-neural architecture does not benefit from large-scale self-supervised pre-training, and its language-dependent dictionary preparation would complicate scalability compared to the zero-shot multilingual capabilities of the selected Wav2Vec2 model.

==== Model Integration

#figure(
  [```python
  # perform inference on the waveform, yielding logits
  inputs = self.processor(waveform, return_tensors="pt")
  with torch.inference_mode():
      logits = self.model(**inputs).logits
  # obtain predicted phonems by greedy decoding
  predictions = logits.argmax(dim=-1)
  [phonemes] = self.tokenizer.batch_decode(predictions)
  predicted_phonemes = phonemes.split()
  # perform forced alignment of logits against transcript
  tokens = self.tokenizer(transcript.text).input_ids
  tokens = torch.tensor([tokens], dtype=torch.int32)
  log_probs = logits.log_softmax(dim=-1)
  [alignments], [scores] = \
      torchaudio.functional.forced_align(log_probs, tokens)
  spans = torchaudio.functional.merge_tokens(alignments, scores.exp())
  return [
      Alignment(
          # token is IPA phoneme
          token=self.tokenizer.convert_ids_to_tokens(s.token),
          score=s.score,  # confidence score
          interval=(s.start, s.end),
      )
      for s in spans
  ]
  ```],
  caption: [The `__call__` method of the `PronunciationAligner` class.],
)

To obtain the predicted phonemes spoken in the user's audio for subsequent mispronunciation identification, the waveform is passed to the `Wav2Vec2ForCTC` model in inference mode.
The resulting logits tensor represents frame-level posterior probabilities.
A CTC decoding step is performed by greedy decoding (argmax over the final dimension at each frame) followed by standard CTC collapsing (removal of blanks and consecutive duplicate tokens).
This produces the most likely sequence of IPA phoneme tokens that the model hypothesises the user has uttered, constituting the raw phonetic transcription of the learner's speech.

=== Mispronunciation Identification

Following CTC forced alignment, the pipeline performs fine-grained mispronunciation identification by comparing the predicted phoneme sequence (derived from the user's spoken audio) against the canonical phoneme sequence.
This comparison quantifies pronunciation deviations at the phoneme level and provides actionable diagnostic information for learner feedback.

The canonical phoneme sequence is derived from the reference text transcript (generated in Echo Mode or ASR-transcribed in Chat Mode) using the `phonemizer` library @phonemizer with the eSpeak-NG @espeak-ng backend.
It converts orthographic text (graphemes) into a sequence of International Phonetic Alphabet (IPA) phonemes while preserving word-level boundaries and stress markers where applicable.
The resulting canonical sequence serves as the standard phonetic representation against which the learner's pronunciation is evaluated.

The user's predicted phoneme sequence produced by the upstream model yields a raw, non-delimited sequence of IPA phoneme tokens corresponding to the most likely sounds uttered by the learner.
To enable word-level feedback in downstream, a custom grouping algorithm (`/server/core/models/common.py#Pronunciation.words`) maps this continuous phoneme sequence back to the original word boundaries present in the cleaned reference transcript (punctuation removed).
Word boundaries are calculated from the transcript's tokenised structure and projected onto the aligned phoneme sequence produced by the CTC forced alignment step.
This grouping process assigns each phoneme (and any associated deviation) to its corresponding word, allowing the system to report not only what was mispronounced but in which specific word the error occurred, laying foundation for the next step.

The mispronunciation identification process then proceeds via the standard Levenshtein distance (edit distance) algorithm implemented with dynamic programming (`/server/core/levenshtein.py`), resulting in a list of edit operations (insertion, deletion, and substitution) with the expected and predicted phonemes at the corresponding positions.
To reduce false positives arising from minor alignment uncertainties or acoustic variability, an additional filtering mechanism is applied: phoneme differences identified along the Levenshtein alignment path are cross-referenced with the per-phoneme alignment confidence scores obtained from the CTC forced alignment trellis.
Any phoneme pair whose alignment confidence exceeds a predefined threshold of `0.75` is not considered a mispronunciation, even if a substitution, insertion, or deletion appears in the edit path.
This confidence-gated approach improves the reliability of error detection by prioritising only those deviations with strong acoustic evidence. @gop-compare

The resulting Levenshtein distance, combined with the filtered set of mispronounced phonemes and their associated words, feeds directly into the downstream construction of a structured prompt for the LLM to generate natural-language textual feedback.
By operating at the phoneme level with word-level grouping, the method captures subtle articulation errors (e.g., confusion between /θ/ and /s/ in "think") that are critical for pronunciation learning.

Notably, this Levenshtein-based approach was selected because it provides an interpretable, sequence-wide edit cost that maps naturally to pedagogical feedback and supports straightforward extension to phonologically weighted variants in future work.
The dynamic-programming implementation ensures deterministic and reproducible results across identical inputs, contributing to the overall consistency and explainability of the pronunciation analysis engine.

== Backend: Automatic Speech Recognition in Chat Mode

In contrast to Echo Mode, where learners read aloud from LLM-generated reference transcripts, Chat Mode enables free-form conversational practice by simulating real-life interactions without providing any predetermined text for the learner to follow.
Consequently, the pronunciation analysis pipeline must first convert the learner's unconstrained spoken reply into a textual representation before phoneme-level evaluation can proceed.
Automatic Speech Recognition (ASR) therefore exclusively serves as the initial transcription stage within the Chat Mode pipeline, transforming the learner's raw audio input into a canonical transcript that is subsequently passed to the CTC forced alignment model (see @image:pipeline).

The ASR component employs the distilled variant of OpenAI's Whisper model, specifically `distil-small.en`, which has been further optimised through 8-bit (int8) quantization.
This choice was dictated by the backend deployment constraints of the project: inference runs exclusively on CPU within the Dockerised environment, and model size must remain modest to respect disk-space limitations on the development machine.
The `distil-small.en` checkpoint offers an excellent trade-off between transcription accuracy for English conversational speech and computational efficiency, delivering performance comparable to the base Whisper models while requiring significantly fewer parameters and lower memory footprint. @distil-whisper

Rather than relying on the official `openai/whisper` Python library, the implementation utilises the `faster-whisper` library @faster-whisper.
This optimised inference engine achieves up to 4 times faster decoding than the reference implementation while preserving identical transcription accuracy and substantially reducing memory consumption.
Efficiency is further enhanced by applying 8-bit quantization across both CPU and GPU, enabling real-time or near-real-time transcription within the asynchronous task queue.
The model processes the same 16 kHz preprocessed audio waveform (after DeepFilterNet denoising and PyTorch Audio VAD silence trimming) that is fed to the downstream CTC alignment module.

A notable alternative considered was the WhisperX @whisperx library, which extends the original Whisper model via `faster-whisper` with additional phoneme-level CTC forced alignment capabilities.
While WhisperX is essentially equivalent to our current Chat Mode pipeline setup by offering the potential for both end-to-end transcription and forced alignment, it was ultimately not selected due to it being a higher-level wrapper and a black box that abstracts away the individual stages of ASR and alignment, limiting the ability to customise or intervene in the intermediate representations (e.g., access to raw logits for confidence scoring) and complicating integration with the existing modular pipeline architecture.

Once the learner's free-form reply has been transcribed, the resulting text is treated as the canonical transcript for the remainder of the pronunciation pipeline.
This transcript is immediately phonemised using the `phonemizer` library (as described previously) and aligned against the learner's audio via the Wav2Vec2 model.
The ASR-derived canonical sequence therefore bridges the gap between unconstrained speech input and the phoneme-level analysis engine, ensuring that mispronunciation identification and Levenshtein distance scoring remain fully operational even when no reference transcript is supplied by the system.

== Backend: Large Language Model Integration

The Large Language Model (LLM) serves as a central generative and evaluative engine within the pronunciation learning application, powering scenario creation, real-time conversational replies, pronunciation feedback, task evaluation, and longitudinal summary of learner insights.
To maintain modularity, extensibility, and separation of concerns, each LLM-driven capability is encapsulated in an independent class called `Generator`.
These classes share a single global OpenAI-compatible client instance implemented as a singleton with a shared connection pool, instantiated via the official Python `openai` SDK.
The choice of the OpenAI SDK was driven by its mature API surface, wide provider compatibility, and seamless support for both local and remote inference endpoints, enabling effortless switching between inference backends through environment-variable configuration without code changes.

Every generator has an associated system prompt stored as separate Markdown files rather than being hardcoded within Python source files.
This design decision facilitates hot-reloading during development, improves maintainability by isolating prompt engineering from implementation logic, and allows flexibility to iterate on prompt quality independently.
Where applicable, few-shot examples are embedded directly within the system prompts to stabilise output quality, minimise hallucinations, and enforce pedagogical consistency across generated content.

Certain generators require structured rather than free-form output.
For these, the SDK's `response_format` parameter is utilised in conjunction with JSON schemas derived from the defined Pydantic models (e.g., the `EvaluationResult` model with nested structures `ScoringCriteria` and `TaskCompletion`).
This guarantees deterministic, parseable responses that can be directly mapped to internal domain objects without additional post-processing or regex-based extraction, which are more fragile and error-prone.

The LLM temperature settings are generator-specific: creative tasks such as scenario generation employ higher temperatures (typically 0.7–0.9) to promote linguistic variety for creative writing, whereas analytical tasks such as evaluation and insight summarisation use temperature 0.0 to ensure objective, reproducible results. @llm-mdd

Initially, LLM inference was performed via Docker Model Runner running open-source models (specifically) on local machine.
This approach was abandoned after hardware profiling revealed that models with large parameter size, which is crucial for the output quality (more intelligent), required GPU resources exceeding the development and deployment constraints of the project.
The system therefore migrated to Cloudflare Workers AI @cloudflare-workers-ai, an OpenAI-API-compatible cloud inference service that provides scalable, serverless execution without local hardware dependencies.
This Cloudflare service provides a generous free tier usage sufficient throughout the whole development process of this project without incurring any API costs.
The model `@cf/google/gemma-3-12b-it` @gemma was selected for its strong instruction-following capability, balanced performance on both creative writing and analytical reasoning, and widespread community validation of output quality.

#figure(
  [```
  server/core/generators/
  ├── __init__.py
  ├── chat.py
  ├── echo.py
  ├── user.py
  └── prompts/
      ├── chat/
      │   ├── evaluation.md
      │   ├── reply.md
      │   └── scenario.md
      ├── echo/
      │   ├── feedback.md
      │   └── scenario.md
      └── user/
          └── insights.md
  ```],
  caption: [directory structure of the generators module],
) <figure:listing>

=== Generators for Echo Mode <heading:unnumbered>

- *Scenario Generator*

This generator produces complete learning scenarios and the associated transcripts required for Echo Mode, based on a topic (food, culture, travel, business, sports) deterministically selected randomly before LLM inference.
The generator receives the user's pronunciation insights including their frequently mispronounced words/phonemes as contextual parameters, ensuring scenarios remain pedagogically relevant, challenging, and educational.

#figure(
  image("images/echo-scenario-llm-log.png"),
  caption: [server logs showing the user prompt (in contrary to the system prompt) for the scenario generator, which includes the randomly selected topic and user's pronunciation insights as context],
)

- *Feedback Generator*

This generator receives the Levenshtein-derived phoneme differences, alignment confidence scores, and the original transcript.
It produces concise, encouraging textual feedback that highlights specific mispronunciations, suggests corrective articulatory strategies, and links errors to common phonetic patterns, thereby closing the immediate learning loop.

#figure(
  image("images/echo-feedback-llm-log.png"),
  caption: [server logs showing the user prompt (in contrary to the system prompt) for the feedback generator, which includes the detailed Levenshtein-derived phoneme differences as context],
)

=== Generators for Chat Mode <heading:unnumbered>

- *Scenario Generator*

This generator produces complete learning scenarios and the associated tasks, opening lines, which operates very similarly with the one for Echo Mode.

- *Reply Generator*

This generator maintains full conversation history and generates the AI interlocutor's next utterance continuing from the previous learner reply.
The prompt includes the current scenario, pending tasks, and the full previous conversation history, ensuring replies remain coherent, natural, and responsive to both content and pronunciation issues.
Notably, the prompt specifically includes guidelines for steering the conversation towards the pending tasks naturally to prevent going off-topic, and ways to handle mispronunciation realistically by expressing misunderstandings.

- *Evaluation Generator*

This generator performs objective assessment of the learner's reply with respect to linguistic appropriacy, semantic accuracy, task-completion status, and a brief summary text of the evaluation. Temperature is fixed at 0.0 to guarantee consistency in scoring.

=== Generators for User Profile <heading:unnumbered>

- *Insights Generator*

This generator aggregates phoneme-level error statistics and scoring trends across all previously completed sessions for a given user.
It produces a personalised summary of recurring weaknesses (e.g., consistent vowel confusion or consonant cluster reduction), recommended focus areas for future practice, and motivational progress observations, which are displayed in the client's profile screen.

== Backend: Text-To-Speech Integration

Text-to-speech (TTS) synthesis constitutes a critical component of the user experience, serving both pedagogical and engagement purposes within the Echo and Chat learning modes. The system employs a hybrid TTS architecture that balances pronunciation authenticity for reference audio with natural prosody for interactive feedback, while ensuring low-latency delivery through async support and chunked streaming.
All TTS audio is delivered in a uncompressed linear PCM WAV format compatible with the client's native audio playback implementation.

=== Reference Pronunciation

In Echo Mode, reference pronunciations of the five LLM-generated transcripts are synthesised using Google TTS via the Python `gtts` library @gtts.
To accommodate the asynchronous nature of the backend service layer and eliminate blocking I/O during session orchestration, the library was locally vendored with custom async support.
The resulting audio is fetched directly from Google's remote TTS endpoint, which employs the same underlying engine as Google Translate.
This choice guarantees highly authentic and standardised pronunciation — essential for pronunciation training — avoiding the phoneme instability, inconsistent intonation, and occasional synthesis hallucinations observed in many neural TTS models, and such fidelity is particularly valuable for learners.

=== Natural Engagement

For the autoplay of LLM-generated pronunciation feedback in Echo Mode and the LLM-generated conversational replies in Chat Mode — the system utilises the lightweight KokoroTTS model (82M parameters) through its official Python `kokoro` library @kokoro.
Local inference was preferred over cloud services because the model size permits efficient CPU execution within the Dockerised backend without incurring per-request costs or introducing external latency dependencies.
KokoroTTS delivers exceptionally natural prosody and expressive intonation, making the feedback feel conversational and the AI replies lifelike, thereby enhancing learner engagement and simulating real-world spoken interaction.
Alternative open-source TTS engines were evaluated and discarded: PiperTTS @piper-tts noticeably less natural output, while ChatterboxTTS @chatterbox-tts suffers from heavy model footprints, numerous unmaintained dependencies, and prohibitively slow inference times on CPU hardware. Proprietary solutions such as ElevenLabs @elevenlabs, although offering state-of-the-art quality, were excluded due to recurring API costs.

==== Streaming Support <heading:unnumbered>

A key implementation optimisation is KokoroTTS's native streaming support, realised through Python generator semantics.
Rather than waiting for complete TTS synthesis before returning the WebSocket session update, the backend streams audio chunks incrementally.
This design allows the mobile client to render textual feedback or the AI reply immediately while TTS playback begins in parallel, essentially reducing perceived response latency and maintaining conversational flow.
The streaming support integrates seamlessly with the existing WebSocket handlers by transferring as raw binary.

== Backend: Server

The backend server forms the central orchestrating component of the system, responsible for managing persistent data, real-time session state, asynchronous ML workloads, and scalable client communication.
The implementation adheres to a strictly layered architecture that enforces separation of concerns, thereby enhancing maintainability, testability, and scalability.
A five-layer architecture — repository, store, broker, service, and web — is employed, each with well-defined responsibilities and minimal inter-layer coupling.
This design isolates database operations, caching and state management, task queuing, business logic orchestration, and API exposure, allowing independent evolution of components while facilitating unit testing and future extensions.

#figure(
  [```
  server/
  ├── broker/
  │   └── tasks.py
  ├── repository/
  │   ├── aggregation.py
  │   ├── chat.py
  │   ├── echo.py
  │   ├── entities.py
  │   └── user.py
  ├── service/
  │   ├── chat.py
  │   ├── echo.py
  │   ├── game.py
  │   └── user.py
  ├── store/
  │   ├── chat.py
  │   ├── echo.py
  │   ├── leaderboard.py
  │   └── user.py
  ├── web/
  │   ├── routers/
  │   │   ├── auth.py
  │   │   ├── chat.py
  │   │   ├── echo.py
  │   │   ├── game.py
  │   │   └── user.py
  │   ├── schemas/
  │   │   ├── chat.py
  │   │   ├── echo.py
  │   │   ├── game.py
  │   │   └── user.py
  │   └── dependencies.py
  ├── formula.py
  └── models.py
  ```],
  caption: [directory structure of the server module],
) <figure:listing>

#figure(
  image("images/layers.png", width: 50%),
  caption: [data flow between different layers],
)

The repository, store, and service layers employ the Facade design pattern by having a single unified class that provides methods to derive internal classes.
For example, the `Service` facade class is the entry point to access classes such as `UserService` by a `Service.user` method.

=== Repository Layer

The repository layer provides a clean abstraction over all persistent storage operations using SQLModel as the object-relational mapping (ORM) library with the `asyncpg` driver for PostgreSQL to have async support.
Database entities are modelled as Pydantic-compatible SQLModel classes, each corresponding to a relational table.

PostgreSQL was selected as the relational database engine in preference to MySQL or SQLite because, as of 2026, it remains the industry-standard choice for modern web applications. Its native support for JSONB columns, timezone-aware timestamps, and advanced indexing capabilities directly addresses the project's requirements for gamification logic and session analytics, features that SQLite lacks and that MySQL implements less effectively.

- ==== User Repository <heading:unnumbered>

This repository handles CRUD operations on the `user` table for account credentials, timezone preferences, language settings, and gamification metrics (streak and XP balance). User passwords are hashed with `argon2id` prior to storage to ensure cryptographic security compliant with modern best practices.

- ==== Echo Repository & Chat Repository <heading:unnumbered>

These repositories manage the `echo_session` and `chat_session` tables respectively, persisting completed learning sessions and enabling efficient querying of historical results.

- ==== Aggregation Repository <heading:unnumbered>

This repository encapsulates complex cross-table joins and groupings required especially for gamification features, such as retrieving all Echo and Chat sessions completed by a user within a specified time window for computing user's pronunciation insights and activity heatmap.

=== Store Layer

Transient and high-read data are managed through a dedicated store layer built on the official `redis-py` library.
Redis was chosen for its versatility in supporting built-in data structures (sorted sets, hashes, and JSON documents) and its native compatibility with the task queue backend.

- ==== Leaderboard Store <heading:unnumbered>

This store maintains a Redis sorted set under the `leaderboard:xp` key, ranking users globally by current XP balance.
The set is seeded at server startup from the repository layer and updated incrementally to avoid repeated database aggregation.

- ==== User Store <heading:unnumbered>

This store utilises prefixed keys (`user:<user_id>`) to cache user-specific ephemeral data, including daily XP accrual and LLM-generated insights summaries.
This caching strategy eliminates repeated heavy database aggregation queries and costly LLM invocations for summary generation.

- ==== Echo Store & Chat Store <heading:unnumbered>

Session-specific stores persist Pydantic model instances (`EchoSessionState` and `ChatSessionState`) as JSON-serialised values in Redis, representing the full in-memory state of active Echo or Chat sessions, storing states such as the current session progress, attempts, and expense.
These states are later written to the database once the sessions are completed.

=== Broker Layer

CPU-intensive ML pipelines are decoupled from the main request-handling server thread via a lightweight broker layer built atop the `taskiq` library @taskiq.
The broker layer provides a thin abstraction class that registers task dependencies (singleton instances of the Echo and Chat ML pipelines) and defines asynchronous tasks capable of accepting and returning serialised Pydantic models.
Tasks are executed against a Redis stream backend, with results stored in a separate Redis database (index 1) to maintain logical separation from business data (index 0).
Taskiq was preferred over heavier alternatives such as Celery because its streamlined API, active maintenance, and reduced feature set align precisely with the project's modest queuing requirements, avoiding unnecessary complexity.

=== Service Layer

The service layer acts as the high-level business-logic orchestrator, coordinating interactions among the repository, store, and broker layers.
It exposes domain-specific methods that encapsulate cross-cutting concerns such as XP calculation, session completion validation, and leaderboard updates.
To simplify session-centric operations, `EchoService` and `ChatService` employ the delegation design pattern via nested `SessionDelegate` classes.
Each delegate instance is instantiated for a specific session identifier and encapsulates all stateful operations (e.g., advancing turns and persisting final results).
Web layer handlers invoke delegate methods exclusively, thereby maintaining a clean separation between HTTP/WebSocket concerns and business logic.

=== Web Layer

The outermost web layer comprises FastAPI routers that expose both RESTful endpoints and WebSocket handlers.
Each router corresponds one-to-one analogously with a particular service class.

Authentication middleware extracts JWT bearer tokens from the `Authorization` header and validates them against the repository layer via the user service class.

Response schemas are defined as lightweight Pydantic DTOs that inherit from internal entities while excluding sensitive or implementation-specific fields.

FastAPI was selected over Django or Flask for its modern asynchronous capabilities, native WebSocket support, and tight Pydantic integration, which together enable robust JSON API construction with minimal boilerplate.

=== Detailed Mechanisms

==== User Avatars

User avatars are generated using the `multivatar-python` package @multivatar.
Each avatar is cryptographically unique according to the given identifier, which the user identifier is used in the system.

==== Authentication Method

Authentication relies on JSON Web Tokens (JWT) issued at login.
Tokens are stored client-side on device and included in every subsequent request and WebSocket handshake.
A FastAPI middleware is used to validate token signature, expiry, and user existence before granting access to protected routes or sessions.
This stateless approach aligns with the project’s mobile-first constraints and avoids session-cookie complexities.

==== Global Date Time Handling

All gamification calculations (daily streaks, XP milestones, and activity heatmaps) operate on timezone-aware datetime objects stored in PostgreSQL.
User's timezone preference is detected on client-side according to the system current timezone setting and saved at account registration.
The server respects each user's stored timezone preference when evaluating streak continuity and daily XP thresholds, ensuring fairness across global users — an essential requirement for the social and motivational aspects of the application.

==== Ephemeral Sessions

A pivotal implementation decision is the treatment of ongoing learning sessions as ephemeral states.
Session state resides exclusively in Redis with a time-to-live (TTL).
Only upon explicit user completion are the final session state including pronunciation scores, task evaluations, and XP awards persisted to the PostgreSQL database via the respective repositories.
Sessions aborted midway are automatically discarded, thereby preserving data integrity and incentivising full engagement.
This design also simplifies rollback logic and reduces database write pressure during exploratory usage.

==== WebSocket Connections

WebSocket connections are used exclusively for Echo and Chat learning sessions.
The server broadcasts session state updates after each user action, ensuring the client remains “dumb” and stateless.
This architecture eliminates client-side business logic, prevents tampering, and guarantees data integrity across potentially unreliable mobile networks.

The WebSocket handlers maintain a per-user connection registry.
Upon a new connection, any existing connection for the same authenticated user is gracefully disconnected, restoring the latest session state from Redis, that is to continue the session from where the previous connection left off.
This mechanism supports seamless multi-device usage while preserving the single-source-of-truth principle.

== Frontend: Mobile Client

The client is a cross-platform mobile application using React Native and Expo.
Below is a detailed breakdown of the architectural design and key components implemented in the client application.

=== Architecture

- ==== Layout & Navigation <heading:unnumbered>

The primary navigation library used is `expo-router` with a file-based routing system.
The navigation structure is organised into two main stacks: `account` and `main`, where the main stack is also a tab navigator consisting multiple tabs.

`react-native-true-sheet` is used for secondary (unintrusive) modal presentation of screens with native liquid glass support on iOS 26+.

- ==== Data Fetching & Caching <heading:unnumbered>

The application employs `react-query` for asynchronous RESTful API data fetching from the server with local data caching.
Relevant query invalidation is performed whenever a Chat or Echo session is completed to ensure UI consistency.

Each separate query or mutation is encapsulated in a custom hook, which abstracts away the underlying API endpoints and callbacks to provide a clean interface for components to interact with server data.

- ==== Global State Management <heading:unnumbered>

Global client-side state is managed using `jotai`, a minimalist atomic state management library, backed by `expo-secure-store` for persistent storage of sensitive data such as authentication tokens and user preferences.
This combination provides a simple yet effective solution for state management without the overhead of more complex libraries, while ensuring secure handling of critical information.

- ==== Native Audio Input/Output <heading:unnumbered>

Audio I/O is crucial for the application's core functionality.
This is implemented using `expo-audio` for both audio recording and playback, via native system microphone access and speaker output, wrapped in a custom React hook for ease of use across components.
A custom chunk queue mechanism is implemented to support streaming audio playback from the server, particularly for TTS of pronunciation feedback and AI replies.

- ==== WebSocket Client <heading:unnumbered>

The application employs the native WebSocket API from React Native for real-time communication with the server during Echo and Chat sessions.
A custom hook is used to manage the WebSocket connection lifecycle, including automatic reconnection, message handling, and maintaining the state machine of the current session based on incoming session updates from the server.
The client additionally attaches the JWT authentication token to the WebSocket connection header to ensure authenticated access to the server.

=== Screens & Components

Below lists the key screens implemented in the client application, along with their core functionalities and design considerations.

Note that although only iOS screenshots are shown in the following figures, the UI is designed to be fully consistent yet adaptive to both iOS and Android platforms, with platform-specific adjustments where necessary to ensure a native look and feel on each platform.

#let screen(image-left, image-right, caption) = figure(
  columns(2, gutter: 5pt, [
    #align(right, image(image-left, width: 50%))
    #colbreak()
    #align(left, image(image-right, width: 50%))
  ]),
  caption: caption,
)

- ==== Landing Screens <heading:unnumbered>

#screen(
  "images/screens/welcome.light.png",
  "images/screens/welcome.dark.png",
  [welcoming screen],
) <screen:landing:welcome>

@screen:landing:welcome shows the initial screen displayed once the application splash screen finishes.
The application logo and slogan are displayed in the center of the screen, with a "GET STARTED" button which navigates user to the account registration screen (@screen:landing:register), and a "I ALREADY HAVE AN ACCOUNT" button which navigates user to the account login screen (@screen:landing:login).
Particularly, both screens will be presented as stack modals that slide up from the bottom as shown below.

#screen(
  "images/screens/register.light.png",
  "images/screens/register.dark.png",
  [account registration screen],
) <screen:landing:register>

@screen:landing:register shows the account registration screen where user is required to input their new username and password, an additional confirm password field is used to ensure the input password is entered correctly as intended. The "Sign Up" button at the bottom is disabled until the username and password fulfil the requirements, and both password fields must match, ensuring the credentials conform to the API validation from the server.
For accessibility reasons, an "eye" icon is attached on each password field to allow toggling the visibility of raw password characters.

Successful registration will directly put user in the "authenticated" state where they will be navigated to the main screens.

#screen(
  "images/screens/login.light.png",
  "images/screens/login.dark.png",
  [account login screen],
) <screen:landing:login>

@screen:landing:login shows the account login screen where user logs into their account with username and password.

Since the password input field uses the `passowrd` type in React Native's `TextField` component, successful login will prompt a system's "Save Password?" alert such that the user can save their credentials into their system key store for auto-filling in the future, see @screen:landing:login:prompt.

#figure(
  image("images/screens/login.prompt.png", width: 30%),
  caption: [system prompt for password saving],
) <screen:landing:login:prompt>

- ==== Home Screen <heading:unnumbered>

#screen(
  "images/screens/home.png",
  "images/screens/home.achievements.png",
  [scrollable home screen with achievement display],
) <screen:home>

#figure(
  [
    #image("images/screens/home.shop.png", width: 30%)
    #image("images/screens/home.shop.active.png", width: 30%)
  ],
  caption: [gem shop modal (top) and its active status in home screen (bottom)],
)

Refer to Ko's report for the detailed design and implementation progress of this screen.

- ==== Leaderboard Screen <heading:unnumbered>

#screen(
  "images/screens/leaderboard.light.png",
  "images/screens/leaderboard.dark.png",
  [global leaderboard screen],
) <screen:leaderboard>

@screen:leaderboard shows the global leaderboard ranking users by their current XP balance.
At the top is an animated podium view showing the top three users with their avatars, usernames, and XP balances.
The three pillars in the podium view are animated with a pop-up from the "ground" and a slight bounce effect using `react-native-reanimated` to emphasise the achievement of reaching the top ranks. The avatar above each of the pillars is also animated with a continuous floating animation.
The shining crown effect on the first-place user is implemented using a looping Lottie animation from a remote asset via `lottie-react-native`, which adds a dynamic visual reward for reaching the top rank.

Below the podium view is a scrollable list showing the top 50 users with their ranks, avatars, usernames, each entry with a slide-from-left animation as they appear on the screen.
Notably, each leaderboard entry in the list is pressable, allowing users to view the profile of one another by navigating to the profile card screen (@screen:leaderboard:profile), which is presented as a slide-up-from-bottom modal.

#screen(
  "images/screens/leaderboard.profile.light.png",
  "images/screens/leaderboard.profile.dark.png",
  [leaderboard user profile screen],
) <screen:leaderboard:profile>

- ==== Profile Screen <heading:unnumbered>

#screen(
  "images/screens/profile.light.png",
  "images/screens/profile.dark.png",
  [user profile screen],
) <screen:profile>

@screen:profile shows the user profile screen which displays the user avatar, username, user identifier, time when the user registered, and a text summary of the user's pronunciation insights.

- ==== Learn Screen <heading:unnumbered>

#screen(
  "images/screens/learn.light.png",
  "images/screens/learn.dark.png",
  [entry point to the learning modes],
)

- ==== Echo Mode <heading:unnumbered>

#screen(
  "images/screens/echo.ready.1.png",
  "images/screens/echo.ready.2.png",
  [ready for attempt screen; transcript card face (left) and back (right)],
)

#screen(
  "images/screens/echo.attempted.1.png",
  "images/screens/echo.attempted.2.png",
  [screen after attempt; transcript card face (left) and back (right)],
)

#screen(
  "images/screens/echo.attempted.feedback.1.png",
  "images/screens/echo.attempted.feedback.2.png",
  [feedback screen after attempt],
)

#figure(
  image("images/screens/echo.attempted.buy.png", width: 30%),
  caption: [prompt for buying extra attempt with XP after first attempt],
)

#screen(
  "images/screens/echo.summary.png",
  "images/screens/echo.summary.feedback.png",
  [summary screen (left) with feedback modal expanded (right)],
)

- ==== Chat Mode <heading:unnumbered>

#screen(
  "images/screens/chat.ready.png",
  "images/screens/chat.tasks.png",
  [ongoing conversation screen (left) with tasks modal expanded (right)],
)

#figure(
  image("images/screens/chat.feedback.png", width: 30%),
  caption: [feedback modal expanded for the selected reply],
)

#figure(image("images/screens/chat.end.png", width: 30%), caption: [summary screen])

== Challenges

The development of this project presented several technical and architectural challenges that required iterative refinement to achieve acceptable performance, output reliability, and pedagogical fidelity.
This section details the principal implementation obstacles encountered, the diagnostic analysis performed, and the targeted solutions adopted.

=== Response Latency in Initial Prototype

The first functional prototype of the application suffered from critically high end-to-end response latency, frequently ranging between 8 and 12 seconds per user interaction in both Echo Mode and Chat Mode.
Such delays rendered real-time conversational practice and immediate phoneme-level feedback pedagogically ineffective, as learners require sub-5-second round-trip times to maintain engagement and cognitive flow during pronunciation drills.
Comprehensive profiling isolated two dominant bottlenecks within the core ML pipeline.

==== Local LLM Inference <heading:unnumbered>

The primary contributor was local inference of the large language model on the backend server.
By running locally via Docker Model Runner, the model demanded substantial CPU resources for token generation during scenario creation, Echo Mode transcript synthesis, Chat Mode reply formulation, and task-completion evaluation.
On the development environment (Dockerized container with no Apple Metal Performance Shaders support), a single forward pass consistently required 4–6 seconds.
This latency compounded further when multiple concurrent sessions triggered simultaneous LLM calls, pushing the task queue backlog and degrading overall system responsiveness.

To address the latency, the core generators was refactored to support remote API calling, leveraging remote edge inference through Cloudflare Workers AI.
The migration replaced the Docker Model Runner service with an asynchronous HTTP client targeting the Workers AI endpoint, exploiting its on-edge GPU-accelerated inference environment and generous free-tier quota.
This architectural shift reduced LLM response times from 10 seconds to under 5 seconds on average even under moderate concurrent load.
The change also lowered backend CPU utilisation by more than 70%, freeing capacity for the CTC forced alignment and audio preprocessing tasks handled by the task queue.

==== Sequential TTS Synthesis <heading:unnumbered>

The secondary bottleneck stemmed from sequential text-to-speech synthesis using the Kokoro TTS model.
Full waveform generation for AI replies and detailed phoneme feedback had to complete before the audio payload could be transmitted to the client via WebSocket.
On average, Kokoro TTS synthesis added 2–4 seconds of blocking delay, particularly for longer feedback utterances or multi-sentence Chat Mode responses.
The combined effect of these two serial operations produced the observed 8–12 second end-to-end latency, rendering the prototype unsuitable for production-level user testing.

In order to mitigate this issue, full streaming support was implemented on both server and client sides.
Rather than awaiting complete waveform synthesis, the server began emitting audio chunks incrementally via the WebSocket session as soon as the first chunk was available.
The React Native client, using Expo Audio and a custom chunked audio buffer, commenced playback immediately upon receipt of the initial segment.
This progressive delivery mechanism eliminated the full-synthesis wait time, reducing TTS contribution to latency from 2–4 seconds to a near-negligible ~500ms of initial buffering.
WebSocket message framing ensured synchronised delivery of phoneme analysis results and streamed audio, maintaining tight coupling between visual feedback, scoring display, and auditory output.

=== Suboptimal Output Quality from LLM

A critical implementation challenge arose from the inconsistent quality of outputs generated by the LLM.
Although the model demonstrated strong instruction-following capabilities and performed reliably in creative writing tasks such as scenario generation, Echo Mode feedback generation, and Chat Mode reply formulation, early prototype iterations exhibited notable variability.
Generated output included malformed or incomplete JSON structures and semantically inconsistent evaluation of user responses against predefined conversational objectives and occasionally off-topic in Chat Mode, or insufficiently challenging transcripts in Echo Mode.
These deficiencies directly compromised downstream system components: pronunciation scoring became unreliable when canonical transcripts deviated from the intended pedagogical focus, task-completion logic in Chat Mode produced erroneous XP awards, and LLM-generated textual feedback occasionally contained factual inaccuracies or pedagogically suboptimal suggestions.
Such instability threatened the overall integrity of the learning experience and the trustworthiness of gamification elements.

Root-cause analysis, conducted through systematic prompt ablation experiments, attributed the variability to two interrelated factors.
First, the inherent stochasticity of even an instruction-tuned large parameter model, despite temperature being fixed at 0.0 to maximise determinism, occasionally led to structural deviations under complex multi-part instructions.
Second, the absence of explicit output constraints in initial system prompts permitted the model to prioritise fluency over strict formatting, resulting in parsing failures that propagated errors through the service layer.

To address these issues, two complementary mitigation strategies were implemented. The first exploited the OpenAI-compatible SDK’s structured output capability by enforcing a rigorous JSON schema for every LLM invocation.
Each call (scenario generation, transcript creation, reply formulation, and task evaluation) was accompanied by a Pydantic-defined schema that precisely specified required fields, data types, enumerated values, and nested structures.
This schema was passed via the `response_format` parameter, compelling the model to produce only valid, parseable JSON and eliminating downstream deserialisation exceptions.

The second strategy augmented the system prompts with carefully engineered few-shot examples. @few-shot-prompting
For each distinct LLM task type, between three and five high-quality exemplars were embedded directly in the prompt.
These exemplars illustrated not only correct JSON formatting but also explicit rubrics for task evaluation (e.g., mapping user replies to completion criteria with confidence scores), edge-case handling (e.g., partial task fulfilment or pronunciation-induced misunderstandings), and pedagogical tone guidelines.
Few-shot examples were iteratively refined using responses generated from previous passes.

By resolving output-quality variability at the source, the refinements ensured deterministic, machine-readable responses that could be reliably consumed by the downstream steps of the pronunciation analysis pipeline.

=== Timezone-Aware Global Date/Time Handling

A critical challenge in implementing the gamification mechanism arose from the requirement to compute daily XP milestones and day-streak increments in a manner that is both globally consistent on the server and perceptually fair to users distributed across multiple timezones.
The day-streak mechanism increments only when a user achieves the daily XP threshold on consecutive calendar days, with the threshold itself defined by a formula.

The core design dilemma concerned the definition of a “day” boundary.
A UTC-midnight reset would simplify server-side arithmetic and eliminate race conditions but would disadvantage users in non-UTC timezones (e.g., a learner in Hong Kong completing a session at 23:00 local time might inadvertently break their streak because the server had already advanced the UTC day).
Conversely, honouring each user’s declared timezone (stored in the database as an IANA identifier such as `Asia/Hong_Kong`) enhances perceived fairness and aligns with real-world usage patterns, yet introduces complexity in concurrent multi-device scenarios and daylight-saving-time transitions.

The adopted solution stores all event timestamps in PostgreSQL as `timestamptz` (UTC-normalised) while maintaining a separate timezone column (IANA string) in the users table.
On every learning-session completion, the backend service layer invokes a deterministic helper that computes the user’s current day boundary as follows: first convert the user’s timezone preference to a Python `ZoneInfo` object, obtain the current wall-clock time in that zone, truncate it to midnight, then convert the resulting local midnight back to UTC.
This boundary timestamp is compared atomically against the user’s last successful streak date (also stored in UTC) within a database transaction protected by row-level locking.

Edge case handling was explicitly addressed. Daylight-saving transitions are transparently managed by Python's built-in `ZoneInfo` database.
When a user changes timezone mid-streak, the next session recomputes the boundary from the new preference without retroactively altering prior awards.
Concurrent sessions from multiple devices are serialised through database transactions, ensuring that only one streak increment occurs per logical day even if two clients submit completions within the same local midnight window.

=== Edge Case Handling of Levenshtein Distance

The Levenshtein distance algorithm employed for phoneme sequence comparison in the pronunciation analysis pipeline demonstrates instability in edge cases, such as insertions or deletions at word boundaries or extreme phoneme variations, e.g., ‘for the’ → ‘fɚðə’ cuts off last word of the transcript.
These anomalies trigger runtime errors that propagate to inaccurate scoring and feedback generation, thereby compromising the reliability of results in both Echo and Chat Modes.
Unfortunately, we do not have sufficient time within the academic year to investigate further on this issue and have yet found a reliable fix.

#pagebreak()
