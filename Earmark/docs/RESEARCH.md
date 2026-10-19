# Voice Recorder Research: What the Best Apps Do Well

_Research date: October 2026. Purpose: decide what a replacement for **Just Press Record** should include, running on iPhone, Apple Watch and Mac with recordings synced the same way Just Press Record syncs them today._

## 1. Apps reviewed

| App | Who it's for | Platforms | Business model |
|---|---|---|---|
| **Just Press Record** (Open Planet) | One-tap capture, synced everywhere | iPhone, iPad, Watch, Mac | One-time purchase |
| **Apple Voice Memos** | Everyone (built in) | iPhone, iPad, Watch, Mac | Free |
| **Ferrite Recording Studio** | Podcasters, journalists | iPhone, iPad | Free + Pro IAP |
| **Noted** | Students, meetings (notes + audio) | iPhone, iPad, Mac | Subscription |
| **Otter.ai** | Meetings, live transcription | iPhone, web | Freemium subscription |
| **Whisper Memos** | Voice-to-text journaling | iPhone, Watch | Subscription (~$60/yr) |
| **AudioPen** | Turning rambles into clean writing | Web, iPhone | Freemium subscription |
| **Voice Record Pro / Awesome Voice Recorder** | Power users who want format control and export targets | iPhone | Free + IAP |

## 2. What each app does best

### Just Press Record (the app being replaced)
- **One tap to record** – big button, nothing else in the way.
- **Apple Watch app + complication** – start from the watch face with one tap; records in the background with the wrist down, with no time limit, even when the iPhone isn't nearby.
- **Watch recordings go to the iPhone automatically**, which then transcribes them and puts them in iCloud. There's a separate tab for watch recordings.
- **iCloud Drive storage** – recordings are plain audio files in iCloud Drive, so they show up on the Mac in Finder and in the Mac app. Transcripts are embedded in the audio file.
- **Transcript search** – search covers transcript text as well as file names.
- **Limitations:** transcription quality drops a lot in noisy rooms; no bookmarks while recording; no summaries; the watch can't record from AirPods; it doesn't do much after the transcript (no titles, no action items).

### Apple Voice Memos
- **Automatic transcripts** (iPhone 12 and later, English locales), searchable.
- **Enhance Recording** (noise and echo reduction) and **Skip Silence** during playback, plus playback speed.
- **Trim / replace** parts of a recording, folders, favorites, **Recently Deleted** with recovery.
- **Location-based naming** ("Home", "Starbucks King St") on new recordings.
- **Layered recording** (iPhone 16 Pro) for musicians.
- **Limitations:** basic organization, weak exports for long files, no summaries, no notes during recording.

### Ferrite Recording Studio
- **Bookmarks while recording** that show up when editing – the best way to say "this part matters" without stopping.
- Multi-track editing, fades, **Strip Silence**, ducking, noise reduction, auto-levelling.
- Undo history that survives closing the app.

### Noted
- **Typed notes while recording, linked to timestamps ("TimeTags").** Tapping a note later jumps the audio to that moment. Very good for lectures and meetings.

### Otter.ai
- **Live transcription** as you speak.
- **Speaker labels**, highlights, shareable notes, meeting summaries.
- **Limitations:** cloud-only processing, subscription, privacy concerns for sensitive audio.

### Whisper Memos
- **Siri, Shortcuts and Action Button** support for hands-free start.
- **Watch complication and standalone watch recording.**
- AI summaries and very accurate transcripts.
- **Limitations:** subscription, recordings processed in the cloud.

### AudioPen
- **Turns rambling speech into clean, organized writing** (summary, key points, rewrite in a chosen style).
- **Limitations:** cloud-based and subscription-based.

### Voice Record Pro / Awesome Voice Recorder
- **Format and quality control** (AAC, Apple Lossless, WAV; sample rate; mono/stereo).
- Many export targets (Files, email, cloud services) and transcript export formats.

### Apple's 2025–2026 platform capabilities (what makes a new app possible)
- **SpeechAnalyzer / SpeechTranscriber** (iOS 26 / macOS 26): Apple's new on-device speech model made for **long-form and far-field audio**, with word-level timestamps. Third-party tests put it ahead of Whisper Small on accuracy and much faster than Whisper Large-v3. No network needed, no per-minute fees.
- **Foundation Models framework** (iOS 26 / macOS 26): on-device language model for **titles, summaries, action items and tags**, free and private.
- **AudioRecordingIntent + Live Activities + Control Center controls** (iOS 18+): start recording from Control Center, the Lock Screen, the Action Button or Siri, with a recording indicator in the Dynamic Island.
- **watchOS background audio**: a recording app with the `audio` background mode keeps recording after the wrist drops.

## 3. The best feature set (what Earmark takes from each)

| Feature | Taken from | In Earmark |
|---|---|---|
| One tap to start recording | Just Press Record | ✅ iPhone, Watch, Mac menu bar |
| Watch complication starts recording right away | Just Press Record, Whisper Memos | ✅ |
| Unlimited background recording on Watch | Just Press Record | ✅ |
| Watch → iPhone transfer, then transcription + iCloud | Just Press Record | ✅ queued, survives app suspension |
| Watch uploads straight to iCloud when the iPhone is away | _new_ | ✅ CloudKit inbox (Wi-Fi/LTE) |
| Plain audio files in iCloud Drive, visible in Finder | Just Press Record | ✅ `iCloud Drive/Earmark/Recordings/<date>/` |
| Mac app showing the same library | Just Press Record, Voice Memos | ✅ plus menu-bar recorder and global hotkey |
| On-device transcription with timestamps | Voice Memos, Just Press Record | ✅ SpeechAnalyzer (long-form model) |
| Live transcript while recording | Otter | ✅ iPhone and Mac |
| Tap a transcript line to jump the audio | Otter, Noted | ✅ |
| Bookmarks while recording | Ferrite | ✅ button, Live Activity, Siri, Watch |
| Typed notes tied to timestamps | Noted | ✅ |
| Auto title, summary, action items, tags | AudioPen, Otter, Whisper Memos | ✅ on-device Foundation Models |
| Location-based names | Voice Memos | ✅ optional |
| Enhanced voice (noise/echo reduction) | Voice Memos, Ferrite | ✅ voice processing on input |
| Skip silence and speed control on playback | Voice Memos | ✅ 0.5×–3× |
| Trim | Voice Memos, Ferrite | ✅ |
| Recently Deleted (30 days) | Voice Memos | ✅ |
| Favorites, tags, Watch filter | Voice Memos, Just Press Record | ✅ |
| Search inside transcripts + Spotlight | Just Press Record | ✅ in-app and system Spotlight |
| Siri / Shortcuts / Action Button / Control Center | Whisper Memos, iOS 18 | ✅ |
| Live Activity / Dynamic Island with pause + bookmark | _new_ | ✅ |
| Quality presets (AAC, ALAC, WAV) | Voice Record Pro | ✅ |
| Export transcript as TXT / Markdown / SRT / VTT | Voice Record Pro, Otter | ✅ |
| **Import existing Just Press Record library** | _new_ | ✅ keeps dates, reuses embedded transcripts |
| Private and no subscription | Just Press Record | ✅ nothing leaves your iCloud |

### Deliberately left out (for now)
- **Multi-track editing / layered recording** (Ferrite, Voice Memos Pro): a different product; Earmark's edits stop at trimming.
- **Speaker labels**: Apple's on-device speech API doesn't separate speakers yet. Listed in the roadmap.
- **Meeting bots that join Zoom/Teams** (Otter): out of scope for a personal recorder.
- **Phone-call recording**: iOS doesn't allow third-party apps to do it.

## Sources
- Just Press Record App Store listing – https://apps.apple.com/app/id1033342465
- MacStories, "Just Press Record Is a Simple Voice Recorder for watchOS 2 and iOS 9" – https://www.macstories.net/?p=40372
- AppleVis, Just Press Record – https://applevis.com/comment/98005
- Apple Voice Memos App Store listing – https://apps.apple.com/app/voice-memos/id1069512134
- iGeeksBlog, "How to Use Voice Memos on iPhone in iOS 26" – https://www.igeeksblog.com/how-to-use-voice-memos-on-iphone-ipad/
- iGeeksBlog, "How to Use Layered Voice Memos on iPhone" – https://www.igeeksblog.com/how-to-use-layered-voice-memos-on-iphone
- Zapier, "Best iPhone voice recorder" – https://zapier.com/blog/best-iphone-voice-recorder/
- Speakwise, "Best voice recorder apps for iPhone" (vendor list) – https://speakwiseapp.com/blog/best-app-voice-recorder-iphone
- Rev, "Best Voice Recorder Apps for iPhone" – https://www.rev.com/blog/10-best-voice-recorder-apps-for-iphone
- Ferrite Recording Studio App Store listing – https://apps.apple.com/app/id1018780185
- journalism.co.uk on Ferrite – https://www.journalism.co.uk/ferrite-recording-studio-launches-as-on-the-go-audio-editing-suite-for-journalists/
- Stuff.co.za on Noted – https://stuff.co.za/2019/07/14/mini-meme-talk-to-the-handset/
- Whisper Memos App Store listing – https://apps.apple.com/us/app/whisper-memos-speech-to-text/id6443658039
- Whisper Memos help: getting started – https://whispermemos.com/kb/getting-started/welcome
- Yaps (competitor, biased) comparisons of Whisper Memos / AudioPen / Otter – https://www.yaps.ai/blog/whisper-memos-alternative.md
- Anton Gubarenko, "iOS 26: SpeechAnalyzer Guide" – https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide
- Gigazine, SpeechAnalyzer vs Whisper speed tests – https://www.gigazine.net/gsc_news/en/20250619-apple-speech-analyzer
- Callstack, on-device transcription with SpeechAnalyzer – https://www.callstack.com/blog/on-device-speech-transcription-with-apple-speechanalyzer
- Apple, `AudioRecordingIntent` – https://developer.apple.com/documentation/appintents/audiorecordingintent
- Apple Developer Forums, starting recordings from intents – https://developer.apple.com/forums/thread/815725
- Apple, Using extended runtime sessions (watchOS) – https://developer.apple.com/documentation/watchkit/using-extended-runtime-sessions
