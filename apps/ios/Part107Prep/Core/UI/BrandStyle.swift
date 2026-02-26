import SwiftUI

enum BrandColor {
    static let background = Color(red: 6 / 255, green: 15 / 255, blue: 37 / 255)
    static let backgroundAlt = Color(red: 7 / 255, green: 26 / 255, blue: 61 / 255)
    static let card = Color(red: 20 / 255, green: 38 / 255, blue: 73 / 255)
    static let border = Color(red: 74 / 255, green: 114 / 255, blue: 177 / 255).opacity(0.35)
    static let textPrimary = Color(red: 241 / 255, green: 246 / 255, blue: 255 / 255)
    static let textMuted = Color(red: 170 / 255, green: 186 / 255, blue: 216 / 255)
    static let primary = Color(red: 58 / 255, green: 142 / 255, blue: 255 / 255)
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
}
