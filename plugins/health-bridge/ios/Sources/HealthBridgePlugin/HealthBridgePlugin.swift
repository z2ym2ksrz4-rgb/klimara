import Foundation
import Capacitor
import HealthKit

/// Write-only bridge to Apple Health. The app mirrors hot flushes and night sweats as category samples so the user's
/// Health timeline carries the diary. Nothing is ever read back.
@objc(HealthBridgePlugin)
public class HealthBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthBridgePlugin"
    public let jsName = "HealthBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeSymptom", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSample", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()
    private static let ids: [String: HKCategoryTypeIdentifier] = [
        "hotFlashes": .hotFlashes, "nightSweats": .nightSweats
    ]
    private func type(_ key: String?) -> HKCategoryType? {
        guard let k = key, let id = HealthBridgePlugin.ids[k] else { return nil }
        return HKObjectType.categoryType(forIdentifier: id)
    }
    private var allTypes: Set<HKSampleType> { Set(HealthBridgePlugin.ids.values.compactMap { HKObjectType.categoryType(forIdentifier: $0) }) }
    private let iso: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private let isoPlain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
    private func date(_ s: String?) -> Date? { guard let s = s else { return nil }; return iso.date(from: s) ?? isoPlain.date(from: s) }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable() && !allTypes.isEmpty])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(), !allTypes.isEmpty else { call.resolve(["granted": false]); return }
        store.requestAuthorization(toShare: allTypes, read: []) { [weak self] ok, _ in
            let anyGranted = self?.allTypes.contains { self?.store.authorizationStatus(for: $0) == .sharingAuthorized } ?? false
            call.resolve(["granted": ok && anyGranted])
        }
    }

    /// kind: hotFlashes | nightSweats; severity 0 unspecified, 2 mild, 3 moderate, 4 severe.
    @objc func writeSymptom(_ call: CAPPluginCall) {
        guard let type = type(call.getString("kind")), let start = date(call.getString("start")), let end = date(call.getString("end")), end >= start else {
            call.reject("bad kind or dates"); return
        }
        if store.authorizationStatus(for: type) != .sharingAuthorized { call.reject("not authorized"); return }
        let sev = call.getInt("severity") ?? 0
        let value: HKCategoryValueSeverity = sev >= 4 ? .severe : sev == 3 ? .moderate : sev == 2 ? .mild : .unspecified
        let sample = HKCategorySample(type: type, value: value.rawValue, start: start, end: end)
        let finish: () -> Void = { [weak self] in
            self?.store.save(sample) { ok, err in
                if ok { call.resolve(["uuid": sample.uuid.uuidString]) } else { call.reject(err?.localizedDescription ?? "save failed") }
            }
        }
        if let old = call.getString("replaceUuid"), let uuid = UUID(uuidString: old) { deleteByUuid(uuid, type) { _ in finish() } } else { finish() }
    }

    @objc func deleteSample(_ call: CAPPluginCall) {
        guard let uuid = UUID(uuidString: call.getString("uuid") ?? ""), let type = type(call.getString("kind")) else { call.resolve(); return }
        deleteByUuid(uuid, type) { _ in call.resolve() }
    }

    private func deleteByUuid(_ uuid: UUID, _ type: HKCategoryType, _ done: @escaping (Bool) -> Void) {
        let pred = HKQuery.predicateForObject(with: uuid)
        let qy = HKSampleQuery(sampleType: type, predicate: pred, limit: 1, sortDescriptors: nil) { [weak self] _, results, _ in
            guard let s = results?.first else { done(false); return }
            self?.store.delete(s) { ok, _ in done(ok) }
        }
        store.execute(qy)
    }
}
