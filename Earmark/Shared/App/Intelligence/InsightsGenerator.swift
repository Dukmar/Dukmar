import Foundation
import FoundationModels

/// Titles, summaries, action items and tags, made on-device with Apple's Foundation Models.
/// Nothing is sent to a server, and there's no per-use cost.
enum InsightsGenerator {
    @Generable
    struct GeneratedInsights {
        @Guide(description: "A short, specific title for the recording, at most 6 words, no quotes or trailing punctuation.")
        var title: String
        @Guide(description: "A summary of the recording in 2 to 4 sentences, written in the same language as the transcript.")
        var summary: String
        @Guide(description: "Concrete tasks, follow-ups or decisions mentioned in the recording. Empty if there are none.", .maximumCount(8))
        var actionItems: [String]
        @Guide(description: "1 to 4 lowercase single-word topic tags.", .maximumCount(4))
        var tags: [String]
    }

    @Generable
    struct ChunkSummary {
        @Guide(description: "The key points of this part of the transcript in 2 to 3 sentences.")
        var summary: String
        @Guide(description: "Tasks, follow-ups or decisions mentioned in this part.", .maximumCount(5))
        var actionItems: [String]
    }

    static var isAvailable: Bool {
        SystemLanguageModel.default.availability == .available
    }

    private static let instructions = """
        You help someone review their own voice recordings: memos, meetings, lectures and ideas. \
        Be faithful to what was said and do not invent details. Write plainly.
        """

    /// The on-device model has a limited context window, so long transcripts are summarized
    /// in chunks first and the chunk summaries are combined.
    static func generate(for transcript: String) async throws -> (insights: RecordingInsights, tags: [String]) {
        let chunks = chunk(transcript, maxCharacters: 6_000)
        var material = transcript
        var chunkActions: [String] = []

        if chunks.count > 1 {
            var partials: [String] = []
            for (index, chunk) in chunks.enumerated() {
                let session = LanguageModelSession(instructions: instructions)
                let response = try await session.respond(
                    to: "Part \(index + 1) of \(chunks.count) of a recording transcript:\n\n\(chunk)",
                    generating: ChunkSummary.self
                )
                partials.append(response.content.summary)
                chunkActions.append(contentsOf: response.content.actionItems)
            }
            material = partials.joined(separator: "\n")
        }

        let session = LanguageModelSession(instructions: instructions)
        let prompt = chunks.count > 1
            ? "These are summaries of consecutive parts of one recording:\n\n\(material)"
            : "Transcript of a recording:\n\n\(material)"
        let response = try await session.respond(to: prompt, generating: GeneratedInsights.self)
        let result = response.content

        var actions = result.actionItems
        for action in chunkActions where !actions.contains(action) { actions.append(action) }

        let insights = RecordingInsights(
            summary: result.summary,
            actionItems: Array(actions.prefix(12)),
            suggestedTitle: result.title.trimmingCharacters(in: CharacterSet(charactersIn: "\"'. ")),
            createdAt: .now
        )
        let tags = result.tags.map { $0.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        return (insights, tags)
    }

    static func chunk(_ text: String, maxCharacters: Int) -> [String] {
        guard text.count > maxCharacters else { return [text] }
        var chunks: [String] = []
        var current = ""
        text.enumerateSubstrings(in: text.startIndex..., options: .bySentences) { sentence, _, _, _ in
            guard let sentence else { return }
            if current.count + sentence.count > maxCharacters, !current.isEmpty {
                chunks.append(current)
                current = ""
            }
            current += sentence
        }
        if !current.isEmpty { chunks.append(current) }
        return chunks
    }
}
