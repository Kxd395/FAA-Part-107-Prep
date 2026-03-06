import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  pruneDelete: vi.fn(),
  contextEnabled: true,
}));

vi.mock("./supabasePersistence", () => ({
  getSupabasePersistenceContext: () => {
    if (!mocks.contextEnabled) return null;
    return {
      client: {
        from: () => ({
          insert: mocks.insert,
          delete: () => ({
            lte: mocks.pruneDelete,
          }),
        }),
      },
      config: {
        tables: {
          userState: "part107_user_state",
          learningEvents: "part107_learning_events",
          questionIssues: "part107_question_issues",
          magicLinkNonces: "part107_magic_link_nonces",
        },
      },
    };
  },
}));

import {
  clearMagicLinkConsumeStoreForTests,
  consumeMagicLinkToken,
  createMagicLinkToken,
} from "./passwordAuth";

describe("passwordAuth remote nonce consumption", () => {
  beforeEach(async () => {
    mocks.insert.mockReset();
    mocks.pruneDelete.mockReset();
    mocks.contextEnabled = true;
    mocks.pruneDelete.mockResolvedValue({ error: null });
    await clearMagicLinkConsumeStoreForTests();
  });

  it("rejects replay when remote nonce table reports duplicate", async () => {
    mocks.insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      });

    const token = createMagicLinkToken("pilot@example.com");
    const first = await consumeMagicLinkToken(token);
    const second = await consumeMagicLinkToken(token);

    expect(first?.email).toBe("pilot@example.com");
    expect(second).toBeNull();
    expect(mocks.insert).toHaveBeenCalledTimes(2);
  });

  it("stores hashed nonce values remotely (never raw nonce)", async () => {
    mocks.insert.mockResolvedValue({ error: null });

    const token = createMagicLinkToken("pilot@example.com");
    const consumed = await consumeMagicLinkToken(token);

    expect(consumed?.email).toBe("pilot@example.com");
    const firstCall = mocks.insert.mock.calls[0]?.[0] as {
      nonce_hash?: string;
      expires_at?: string;
      consumed_at?: string;
    };
    expect(firstCall.nonce_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstCall.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(firstCall.consumed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
