import Foundation

struct AppConfig: Equatable {
    let apiBaseURL: URL
    let requestTimeoutSeconds: TimeInterval
    let useLocalQuestionFallback: Bool

    static func fromEnvironment() -> AppConfig {
        let info = Bundle.main.infoDictionary ?? [:]
        let baseURLString = (info["PART107_API_BASE_URL"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let timeout = (info["PART107_REQUEST_TIMEOUT"] as? NSNumber)?.doubleValue ?? 15
        let useFallback = (info["PART107_USE_LOCAL_FALLBACK"] as? NSNumber)?.boolValue ?? true

        let resolvedURL: URL
        if let baseURLString, let url = URL(string: baseURLString), !baseURLString.isEmpty {
            resolvedURL = url
        } else {
            resolvedURL = URL(string: "http://localhost:3000")!
        }

        return AppConfig(
            apiBaseURL: resolvedURL,
            requestTimeoutSeconds: timeout,
            useLocalQuestionFallback: useFallback
        )
    }
}
