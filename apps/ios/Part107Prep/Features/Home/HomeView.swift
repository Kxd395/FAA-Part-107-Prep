import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var devUserId: String = "pilot_user_1"

    private var isPadLayout: Bool { horizontalSizeClass == .regular }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: isPadLayout ? 20 : 14) {
                    VStack(spacing: isPadLayout ? 18 : 12) {
                        heroSection
                        actionRow
                        selectorCard
                        statsGrid
                        howItWorks
                        syncCard
                        if let error = appState.lastError {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(Color.red.opacity(0.95))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .brandCard()
                        }
                    }
                    .frame(maxWidth: isPadLayout ? 1100 : 560)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, isPadLayout ? 24 : 12)
                .padding(.top, isPadLayout ? 8 : 2)
                .safeAreaPadding(.bottom, isPadLayout ? 48 : 92)
            }
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
        }
    }

    private var heroSection: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "airplane")
                Text("Part 107 Prep")
                    .font(.title3.weight(.semibold))
            }
            .foregroundStyle(BrandColor.textPrimary)
            Text("Updated for 2026 FAA Rules")
                .brandChip(active: true)
            Text("Pass Your Part 107 Exam")
                .font(.system(size: isPadLayout ? 52 : 30, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center)
            Text("Free FAA Remote Pilot prep with instant feedback, detailed explanations, and high-res charts.")
                .font(.callout)
                .foregroundStyle(BrandColor.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 14)
    }

    private var actionRow: some View {
        HStack(spacing: 10) {
            NavigationLink("Start Studying", destination: StudyView(viewModel: appState.studyVM))
                .buttonStyle(PrimaryBrandButton())
            NavigationLink("Practice Exam", destination: ExamView())
                .buttonStyle(SecondaryBrandButton())
        }
        .frame(maxWidth: isPadLayout ? 680 : .infinity)
    }

    private var selectorCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Practice Question Type")
                .font(.caption)
                .foregroundStyle(BrandColor.textMuted)
            HStack(spacing: 8) {
                Text("Confirmed Test Questions")
                    .brandChip(active: true)
                Text("All Questions")
                    .brandChip()
            }
            Text("Selected: Confirmed Test Questions")
                .font(.footnote)
                .foregroundStyle(BrandColor.textPrimary)
            Text("UAG format is 60 questions, 2.0 hours, 70% passing.")
                .font(.footnote)
                .foregroundStyle(BrandColor.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .brandCard()
    }

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: isPadLayout ? 14 : 8) {
            statCard(title: "Questions", value: "\(appState.questionCount)", subtitle: "Live loaded bank")
            statCard(title: "Pass Rate", value: "70%", subtitle: "42 of 60 to pass")
            statCard(title: "Time Limit", value: "2 hrs", subtitle: "120 minutes")
            statCard(title: "Updated", value: "2026", subtitle: "Source-pack audit year")
        }
    }

    private var howItWorks: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("How It Works")
                .font(.title3.weight(.semibold))
            LazyVGrid(
                columns: isPadLayout
                    ? [GridItem(.flexible()), GridItem(.flexible())]
                    : [GridItem(.flexible())],
                spacing: isPadLayout ? 12 : 8
            ) {
                FeatureCard(
                    title: "Study Mode",
                    subtitle: "Answer questions with instant feedback and explanation after each answer.",
                    gradient: [BrandColor.card, Color(red: 26 / 255, green: 56 / 255, blue: 106 / 255)],
                    icon: "book.closed"
                )
                FeatureCard(
                    title: "Exam Mode",
                    subtitle: "60 questions, 2 hours, final score report and review pass.",
                    gradient: [Color(red: 40 / 255, green: 32 / 255, blue: 84 / 255), Color(red: 66 / 255, green: 39 / 255, blue: 113 / 255)],
                    icon: "target"
                )
                FeatureCard(
                    title: "Flashcards",
                    subtitle: "Spaced repetition that resurfaces cards you still struggle with.",
                    gradient: [Color(red: 52 / 255, green: 29 / 255, blue: 69 / 255), Color(red: 93 / 255, green: 39 / 255, blue: 89 / 255)],
                    icon: "rectangle.stack"
                )
            }
        }
    }

    private var syncCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sync")
                .font(.headline)
            Text(appState.syncStatus)
                .font(.footnote)
                .foregroundStyle(BrandColor.textMuted)
            TextField("Dev user id", text: $devUserId)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            HStack(spacing: 10) {
                Button("Sign In (Dev)") {
                    Task { await appState.signInForDevelopment(userId: devUserId) }
                }
                .buttonStyle(PrimaryBrandButton())
                Button("Sign Out") {
                    Task { await appState.signOut() }
                }
                .buttonStyle(SecondaryBrandButton())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .brandCard()
    }

    private func statCard(title: String, value: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title2.weight(.bold))
            Text(title)
                .font(.subheadline.weight(.medium))
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(BrandColor.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .brandCard()
    }
}
