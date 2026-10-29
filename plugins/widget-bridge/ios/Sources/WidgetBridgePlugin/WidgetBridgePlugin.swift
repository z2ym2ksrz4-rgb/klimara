import Foundation
import Capacitor
import WidgetKit
import UIKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        // Tell JS when the user takes a screenshot (used for the in-app "send feedback?" prompt in TestFlight builds).
        NotificationCenter.default.addObserver(forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("screenshot", data: [:])
        }
    }

    @objc func setData(_ call: CAPPluginCall) {
        let group = call.getString("group") ?? "group.com.ilumie.klimara"
        let json = call.getString("json") ?? "{}"
        if let d = UserDefaults(suiteName: group) {
            d.set(json, forKey: "widgetData")
            d.synchronize()
        }
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        call.resolve()
    }

    /** Build/environment facts the web layer cannot see: TestFlight (sandbox receipt), version, build, device. */
    @objc func info(_ call: CAPPluginCall) {
        let receipt = Bundle.main.appStoreReceiptURL?.lastPathComponent ?? ""
        let isTestFlight = receipt == "sandboxReceipt"
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        var sys = utsname(); uname(&sys)
        let model = withUnsafePointer(to: &sys.machine) { $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(validatingUTF8: $0) } } ?? UIDevice.current.model
        call.resolve(["isTestFlight": isTestFlight, "version": v, "build": b, "os": "iOS \(UIDevice.current.systemVersion)", "device": model])
    }
}
