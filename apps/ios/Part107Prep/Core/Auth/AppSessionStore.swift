import Foundation

protocol SessionTokenStore {
    func readToken() -> String?
    func writeToken(_ token: String?)
}

struct UserDefaultsSessionTokenStore: SessionTokenStore {
    private let defaults: UserDefaults
    private let key: String

    init(defaults: UserDefaults = .standard, key: String = "part107_app_session_token") {
        self.defaults = defaults
        self.key = key
    }

    func readToken() -> String? {
        defaults.string(forKey: key)
    }

    func writeToken(_ token: String?) {
        if let token, !token.isEmpty {
            defaults.set(token, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
