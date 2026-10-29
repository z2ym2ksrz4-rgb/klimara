import WidgetKit
import SwiftUI

// Reads the JSON snapshot the app writes to the App Group (see plugins/widget-bridge). All strings arrive pre-localised.
// Tapping any family opens the app through the deep link: klimara://flush/new logs a hot flush immediately.
struct Data: Decodable { let cta: String; let open: Bool; let line1: String; let line2: String; let url: String; let updatedAt: String }
struct Entry: TimelineEntry { let date: Date; let data: Data? }

struct Provider: TimelineProvider {
    static let group = "group.com.ilumie.klimara"
    func load() -> Data? {
        guard let s = UserDefaults(suiteName: Provider.group)?.string(forKey: "widgetData"), let d = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Data.self, from: d)
    }
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), data: Data(cta: "Hot flush now", open: false, line1: "Today: 3 hot flushes", line2: "7-day avg. 2.4 a day", url: "klimara://flush/new", updatedAt: "")) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date(), data: load() ?? placeholder(in: context).data)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date())!
        completion(Timeline(entries: [Entry(date: Date(), data: load())], policy: .after(next)))
    }
}

let apricot = Color(red: 0.95, green: 0.64, blue: 0.49)
let apricotDark = Color(red: 0.84, green: 0.37, blue: 0.23)
let ink = Color(red: 0.14, green: 0.27, blue: 0.24)
let cream = Color(red: 0.96, green: 0.95, blue: 0.91)

/// Belly mark: a belly in profile with a small cramp zigzag inside – same as the app icon (viewBox 250 60 600 900).
struct BellyOutline: Shape {
    func path(in r: CGRect) -> Path {
        let sx = r.width / 600, sy = r.height / 900, s = min(sx, sy)
        let ox = r.minX + (r.width - 600 * s) / 2 - 250 * s, oy = r.minY + (r.height - 900 * s) / 2 - 60 * s
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        var p = Path()
        p.move(to: pt(320, 90))
        p.addCurve(to: pt(352, 332), control1: pt(320, 210), control2: pt(312, 280))
        p.addCurve(to: pt(750, 570), control1: pt(570, 320), control2: pt(750, 430))
        p.addCurve(to: pt(380, 790), control1: pt(750, 720), control2: pt(600, 796))
        p.addCurve(to: pt(342, 900), control1: pt(352, 820), control2: pt(342, 860))
        return p
    }
}
struct BellyFill: Shape {
    func path(in r: CGRect) -> Path {
        let s = min(r.width / 600, r.height / 900)
        let ox = r.minX + (r.width - 600 * s) / 2 - 250 * s, oy = r.minY + (r.height - 900 * s) / 2 - 60 * s
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        var p = Path()
        p.move(to: pt(352, 332))
        p.addCurve(to: pt(750, 570), control1: pt(570, 320), control2: pt(750, 430))
        p.addCurve(to: pt(380, 790), control1: pt(750, 720), control2: pt(600, 796))
        p.closeSubpath()
        return p
    }
}
struct Cramp: Shape {
    func path(in r: CGRect) -> Path {
        let s = min(r.width / 600, r.height / 900)
        let ox = r.minX + (r.width - 600 * s) / 2 - 250 * s, oy = r.minY + (r.height - 900 * s) / 2 - 60 * s
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        var p = Path()
        p.move(to: pt(480, 480)); p.addLine(to: pt(530, 540)); p.addLine(to: pt(480, 600)); p.addLine(to: pt(530, 660))
        return p
    }
}
struct Belly: View {
    var size: CGFloat
    var line: Color = cream
    var fill: Color = apricot
    var cramp: Color = ink
    var body: some View {
        ZStack {
            BellyFill().fill(fill)
            BellyOutline().stroke(line, style: StrokeStyle(lineWidth: size * 0.075, lineCap: .round, lineJoin: .round))
            Cramp().stroke(cramp, style: StrokeStyle(lineWidth: size * 0.052, lineCap: .round, lineJoin: .round))
        }.frame(width: size, height: size)
    }
}

struct SmallView: View {
    let data: Data?
    var body: some View {
        ZStack {
            ContainerRelativeShape().fill(LinearGradient(colors: data?.open == true ? [apricot, apricotDark] : [ink, ink], startPoint: .topLeading, endPoint: .bottomTrailing))
            VStack(spacing: 8) {
                Belly(size: 54)
                Text(data?.cta ?? "Hot flush now").font(.system(.headline, design: .serif)).foregroundColor(.white).multilineTextAlignment(.center).lineLimit(2)
            }.padding(12)
        }
    }
}

struct MediumView: View {
    let data: Data?
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 22).fill(LinearGradient(colors: data?.open == true ? [apricot, apricotDark] : [ink, ink], startPoint: .topLeading, endPoint: .bottomTrailing))
                VStack(spacing: 6) { Belly(size: 44); Text(data?.cta ?? "Hot flush now").font(.system(.subheadline, design: .serif).weight(.medium)).foregroundColor(.white).multilineTextAlignment(.center).lineLimit(2) }.padding(8)
            }.frame(width: 120)
            VStack(alignment: .leading, spacing: 6) {
                Text("Klimara").font(.system(.headline, design: .serif))
                Text(data?.line1 ?? "").font(.footnote.weight(.semibold)).lineLimit(2)
                Text(data?.line2 ?? "").font(.caption).foregroundColor(.secondary).lineLimit(2)
                Spacer(minLength: 0)
            }
            Spacer(minLength: 0)
        }.padding(14)
    }
}

struct LockRectView: View {
    let data: Data?
    var body: some View {
        HStack(spacing: 8) {
            Belly(size: 28, line: .primary, fill: .clear, cramp: .primary)
            VStack(alignment: .leading, spacing: 1) {
                Text(data?.cta ?? "Hot flush now").font(.headline).lineLimit(1)
                Text(data?.line1 ?? "").font(.caption2).foregroundColor(.secondary).lineLimit(1)
            }
        }
    }
}

struct LockCircleView: View {
    var body: some View { ZStack { AccessoryWidgetBackground(); Belly(size: 30, line: .primary, fill: .clear, cramp: .primary) } }
}

struct AttackEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry
    var body: some View {
        switch family {
        case .systemSmall: SmallView(data: entry.data)
        case .accessoryRectangular: LockRectView(data: entry.data)
        case .accessoryCircular: LockCircleView()
        default: MediumView(data: entry.data)
        }
    }
}

@main
struct AttackWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AttackWidget", provider: Provider()) { entry in
            let view = AttackEntryView(entry: entry).widgetURL(URL(string: entry.data?.url ?? "klimara://flush/new"))
            if #available(iOS 17.0, *) { view.containerBackground(.background, for: .widget) } else { view }
        }
        .configurationDisplayName("Klimara")
        .description("Log a hot flush with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
        .contentMarginsDisabled()
    }
}
