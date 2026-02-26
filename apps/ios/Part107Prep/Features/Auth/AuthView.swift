import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var appState: AppState
    @State private var devUserId: String = "pilot_user_1"

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                HStack {
                    Text("Auth")
                        .font(.title3.weight(.semibold))
                    Spacer()
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Status")
                        .font(.caption)
                        .foregroundStyle(BrandColor.textMuted)
                    Text(appState.syncStatus)
                        .font(.body)
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

                if let error = appState.lastError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.red.opacity(0.95))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .brandCard()
                }

                Spacer()
            }
            .padding()
            .safeAreaPadding(.bottom, 92)
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
        }
    }
}
