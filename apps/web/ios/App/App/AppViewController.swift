import UIKit
import Capacitor

/// The app's web view controller: Capacitor's, plus the app's own small plugin and the
/// launch screen's background, so nothing flashes white before the page draws.
class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppearancePlugin())
        // Follows light and dark, unlike Capacitor's backgroundColor setting.
        let background = UIColor(named: "LaunchBackground")
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        // The page reads the system text size; tell it when that changes while the app is open.
        NotificationCenter.default.addObserver(
            self, selector: #selector(textSizeDidChange),
            name: UIContentSizeCategory.didChangeNotification, object: nil)
    }

    @objc private func textSizeDidChange() {
        bridge?.triggerWindowJSEvent(eventName: "systemtextsize")
    }
}

/// Lets the page's Light, Dark, or System setting drive the native appearance, so the
/// status bar, keyboard, and system sheets match the page. Called from apps/web/src/native.ts.
@objc(AppearancePlugin)
class AppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "AppearancePlugin"
    let jsName = "Appearance"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setMode", returnType: CAPPluginReturnPromise)
    ]

    // Kept natively too, so the window has the right style before the page loads.
    static let modeKey = "appearanceMode"

    static func style(for mode: String?) -> UIUserInterfaceStyle {
        switch mode {
        case "light": return .light
        case "dark": return .dark
        default: return .unspecified
        }
    }

    @objc func setMode(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "system"
        UserDefaults.standard.set(mode, forKey: Self.modeKey)
        DispatchQueue.main.async {
            self.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = Self.style(for: mode)
            call.resolve()
        }
    }
}
