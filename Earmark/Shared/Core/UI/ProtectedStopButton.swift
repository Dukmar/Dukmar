import SwiftUI

/// The stop button, guarded against accidental taps (pocket, sleeve, a stray thumb).
///
/// - `.hold`: press and hold for about a second; a ring fills while holding. A quick tap only shows "Hold to stop".
/// - `.confirm`: tap, then confirm in a dialog.
/// - `.tap`: stops immediately (Just Press Record behaviour).
///
/// VoiceOver users activate it with the usual double-tap, which is already a deliberate action.
struct ProtectedStopButton<Label: View>: View {
    var protection: StopProtection = AppSettings.stopProtection
    var holdDuration: Double = 1.0
    var ringColor: Color = .white
    var action: () -> Void
    @ViewBuilder var label: () -> Label

    @State private var progress: CGFloat = 0
    @State private var completed = false
    @State private var showHint = false
    @State private var showConfirm = false
    @State private var stopCount = 0

    var body: some View {
        content
            .sensoryFeedback(.success, trigger: stopCount)
            .accessibilityLabel("Stop and save recording")
    }

    @ViewBuilder private var content: some View {
        switch protection {
        case .tap:
            Button(action: stop, label: label)
                .buttonStyle(.plain)
        case .confirm:
            Button { showConfirm = true } label: { label() }
                .buttonStyle(.plain)
                .confirmationDialog("Stop recording?", isPresented: $showConfirm, titleVisibility: .visible) {
                    Button("Stop and Save", role: .destructive, action: stop)
                    Button("Keep Recording", role: .cancel) {}
                }
        case .hold:
            label()
                .overlay {
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(ringColor, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(-6)
                }
                .overlay(alignment: .bottom) {
                    if showHint {
                        Text("Hold to stop")
                            .font(.caption2.bold())
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(.regularMaterial, in: Capsule())
                            .fixedSize()
                            .offset(y: 26)
                            .transition(.opacity)
                    }
                }
                .contentShape(Circle())
                .onLongPressGesture(minimumDuration: holdDuration, maximumDistance: 40) {
                    completed = true
                    stop()
                } onPressingChanged: { pressing in
                    if pressing {
                        completed = false
                        withAnimation(.linear(duration: holdDuration)) { progress = 1 }
                    } else {
                        withAnimation(.easeOut(duration: 0.2)) { progress = 0 }
                        if !completed { flashHint() }
                    }
                }
                .accessibilityAddTraits(.isButton)
                .accessibilityHint("Stops and saves the recording.")
                .accessibilityAction { stop() }
        }
    }

    private func stop() {
        stopCount += 1
        action()
    }

    private func flashHint() {
        withAnimation { showHint = true }
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            withAnimation { showHint = false }
        }
    }
}
