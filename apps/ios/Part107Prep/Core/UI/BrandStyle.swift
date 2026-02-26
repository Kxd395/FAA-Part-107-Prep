import SwiftUI

enum BrandColor {
    static let background = Color(red: 4 / 255, green: 13 / 255, blue: 34 / 255)
    static let backgroundAlt = Color(red: 6 / 255, green: 22 / 255, blue: 54 / 255)
    static let card = Color(red: 15 / 255, green: 30 / 255, blue: 57 / 255)
    static let cardAlt = Color(red: 12 / 255, green: 24 / 255, blue: 48 / 255)
    static let border = Color(red: 82 / 255, green: 128 / 255, blue: 196 / 255).opacity(0.33)
    static let textPrimary = Color(red: 241 / 255, green: 246 / 255, blue: 255 / 255)
    static let textMuted = Color(red: 170 / 255, green: 186 / 255, blue: 216 / 255)
    static let primary = Color(red: 58 / 255, green: 142 / 255, blue: 255 / 255)
    static let primarySoft = Color(red: 58 / 255, green: 142 / 255, blue: 255 / 255).opacity(0.18)
    static let success = Color(red: 36 / 255, green: 190 / 255, blue: 118 / 255).opacity(0.24)
    static let danger = Color(red: 239 / 255, green: 95 / 255, blue: 95 / 255).opacity(0.24)
}

struct BrandScreen: ViewModifier {
    func body(content: Content) -> some View {
        ZStack {
            LinearGradient(
                colors: [BrandColor.background, BrandColor.backgroundAlt],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            content
        }
        .tint(BrandColor.primary)
    }
}

struct BrandCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(BrandColor.card.opacity(0.92))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(BrandColor.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct BrandChip: ViewModifier {
    var active: Bool

    func body(content: Content) -> some View {
        content
            .font(.caption.weight(.semibold))
            .foregroundStyle(BrandColor.textPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(active ? BrandColor.primarySoft : BrandColor.cardAlt.opacity(0.9))
            .overlay(
                Capsule().stroke(active ? BrandColor.primary.opacity(0.85) : BrandColor.border, lineWidth: 1)
            )
            .clipShape(Capsule())
    }
}

struct FeatureCard: View {
    let title: String
    let subtitle: String
    let gradient: [Color]
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(BrandColor.textPrimary.opacity(0.95))
            Text(title)
                .font(.headline)
                .foregroundStyle(BrandColor.textPrimary)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(BrandColor.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading)
        .padding()
        .background(
            LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(BrandColor.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct PrimaryBrandButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(BrandColor.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(BrandColor.primary.opacity(configuration.isPressed ? 0.85 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct SecondaryBrandButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(BrandColor.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(BrandColor.card.opacity(configuration.isPressed ? 0.78 : 0.92))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(BrandColor.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

extension View {
    func brandScreen() -> some View {
        modifier(BrandScreen())
    }

    func brandCard() -> some View {
        modifier(BrandCard())
    }

    func brandChip(active: Bool = false) -> some View {
        modifier(BrandChip(active: active))
    }
}
