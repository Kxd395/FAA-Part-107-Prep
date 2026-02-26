import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case transport(String)
    case invalidResponse
    case statusCode(Int)
    case decoding(String)
    case encoding(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid API URL."
        case .transport(let message): return "Network error: \(message)"
        case .invalidResponse: return "Invalid server response."
        case .statusCode(let code): return "Server returned status \(code)."
        case .decoding(let message): return "Failed to decode response: \(message)"
        case .encoding(let message): return "Failed to encode request: \(message)"
        case .unauthorized: return "You are not authenticated."
        }
    }
}

actor APIClient {
    let config: AppConfig
    let urlSession: URLSession
    private let tokenStore: SessionTokenStore

    init(
        config: AppConfig,
        urlSession: URLSession = .shared,
        tokenStore: SessionTokenStore = UserDefaultsSessionTokenStore()
    ) {
        self.config = config
        self.urlSession = urlSession
        self.tokenStore = tokenStore
    }

    func getQuestions(category: String = "All", questionType: String = "confirmed_test") async throws -> [Question] {
        guard var components = URLComponents(
            url: config.apiBaseURL.appendingPathComponent("/api/questions"),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "category", value: category),
            URLQueryItem(name: "type", value: questionType),
        ]
        let response: QuestionApiResponse = try await sendRequest(
            path: components.string ?? "/api/questions",
            method: "GET",
            requiresAuth: false
        )
        return response.questions
    }

    func getAuthSession() async throws -> AuthSessionResponse {
        try await sendRequest(path: "/api/auth/session", method: "GET", requiresAuth: false)
    }

    @discardableResult
    func createDevSession(userId: String) async throws -> AuthSessionResponse {
        let body = ["userId": userId]
        let session: AuthSessionResponse = try await sendRequest(
            path: "/api/auth/session",
            method: "POST",
            body: body,
            requiresAuth: false
        )
        return session
    }

    func fetchUserState() async throws -> UserStatePayload {
        try await sendRequest(path: "/api/user/state", method: "GET", requiresAuth: true)
    }

    func saveUserState(mode: String, data: [String: String]) async throws -> UserStateSaveResponse {
        let body: [String: AnyCodable] = [
            "mode": AnyCodable(mode),
            "data": AnyCodable(data),
        ]
        return try await sendRequest(path: "/api/user/state", method: "PUT", body: body, requiresAuth: true)
    }

    @discardableResult
    func postLearningEvent(_ event: LearningEventPayload) async throws -> LearningEventAcceptedResponse {
        let envelope = LearningEventEnvelope(event: event)
        return try await sendRequest(path: "/api/user/learning-events", method: "POST", body: envelope, requiresAuth: true)
    }

    func fetchScoringSummary(window: String = "30d") async throws -> ScoringSummaryResponse {
        try await sendRequest(
            path: "/api/user/scoring/summary?window=\(window)",
            method: "GET",
            requiresAuth: true
        )
    }

    func clearSessionToken() {
        tokenStore.writeToken(nil)
    }

    private func sendRequest<T: Decodable>(
        path: String,
        method: String,
        requiresAuth: Bool
    ) async throws -> T {
        let request = try buildRequest(path: path, method: method, bodyData: nil, requiresAuth: requiresAuth)
        let (data, http) = try await sendRaw(request)
        captureSessionToken(from: http)

        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIError.unauthorized }
            throw APIError.statusCode(http.statusCode)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    private func sendRequest<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body? = nil,
        requiresAuth: Bool
    ) async throws -> T {
        let bodyData: Data?
        if let body {
            do {
                bodyData = try JSONEncoder().encode(body)
            } catch {
                throw APIError.encoding(error.localizedDescription)
            }
        } else {
            bodyData = nil
        }

        let request = try buildRequest(path: path, method: method, bodyData: bodyData, requiresAuth: requiresAuth)
        let (data, http) = try await sendRaw(request)
        captureSessionToken(from: http)

        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIError.unauthorized }
            throw APIError.statusCode(http.statusCode)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    private func buildRequest(
        path: String,
        method: String,
        bodyData: Data?,
        requiresAuth: Bool
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: config.apiBaseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = config.requestTimeoutSeconds
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ios", forHTTPHeaderField: "x-client-platform")
        if requiresAuth, let token = tokenStore.readToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue(token, forHTTPHeaderField: "x-part107-auth-token")
        }
        if let bodyData {
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    private func sendRaw(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        return (data, http)
    }

    private func captureSessionToken(from response: HTTPURLResponse) {
        guard let setCookie = response.value(forHTTPHeaderField: "Set-Cookie") else { return }
        guard let token = extractAuthToken(setCookieHeader: setCookie) else { return }
        tokenStore.writeToken(token)
    }

    private func extractAuthToken(setCookieHeader: String) -> String? {
        let sections = setCookieHeader.split(separator: ";").map { $0.trimmingCharacters(in: .whitespaces) }
        guard let pair = sections.first else { return nil }
        let chunks = pair.split(separator: "=", maxSplits: 1).map(String.init)
        guard chunks.count == 2 else { return nil }
        guard chunks[0] == "part107_auth", !chunks[1].isEmpty else { return nil }
        return chunks[1]
    }
}

struct AnyCodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        encodeClosure = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
