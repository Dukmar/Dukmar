import Carbon.HIToolbox
import Foundation

/// System-wide ⌃⌥⌘R to start/stop recording from any app. Carbon hot keys don't need
/// Accessibility permission, unlike global key monitors.
@MainActor
final class GlobalHotKey {
    var onPress: (() -> Void)?

    private var hotKeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?

    func setEnabled(_ enabled: Bool) {
        enabled ? register() : unregister()
    }

    private func register() {
        guard hotKeyRef == nil else { return }
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let context = Unmanaged.passUnretained(self).toOpaque()
        InstallEventHandler(GetApplicationEventTarget(), earmarkHotKeyHandler, 1, &eventType, context, &handlerRef)

        let id = EventHotKeyID(signature: OSType(0x45524D4B), id: 1) // "ERMK"
        RegisterEventHotKey(UInt32(kVK_ANSI_R), UInt32(cmdKey | optionKey | controlKey), id,
                            GetApplicationEventTarget(), 0, &hotKeyRef)
    }

    private func unregister() {
        if let hotKeyRef { UnregisterEventHotKey(hotKeyRef) }
        if let handlerRef { RemoveEventHandler(handlerRef) }
        hotKeyRef = nil
        handlerRef = nil
    }
}

/// C callback for the hot key. Lives at file scope so it isn't inferred as main-actor isolated.
private func earmarkHotKeyHandler(_: EventHandlerCallRef?, _: EventRef?, _ userData: UnsafeMutableRawPointer?) -> OSStatus {
    guard let userData else { return noErr }
    let hotKey = Unmanaged<GlobalHotKey>.fromOpaque(userData).takeUnretainedValue()
    DispatchQueue.main.async { MainActor.assumeIsolated { hotKey.onPress?() } }
    return noErr
}
