import { describe, expect, it } from "vitest";
import { StorageError } from "@/storage/StorageProvider";
import { isAlreadyExists, shareErrorMessage } from "./shareError";

describe("shareErrorMessage", () => {
  it("translates known server messages", () => {
    expect(shareErrorMessage(new StorageError("server", "Share link e7b3 already exists.", 400))).toBe("이미 이 파일의 공유 링크가 있습니다");
    expect(shareErrorMessage(new StorageError("server", "Password is too short.", 400))).toMatch(/최소 길이/);
    expect(shareErrorMessage(new StorageError("server", "Password is too weak.", 400))).toMatch(/단순/);
  });

  it("keeps unknown messages visible", () => {
    expect(shareErrorMessage(new StorageError("server", "Quota exceeded.", 400))).toBe("링크를 만들지 못했습니다: Quota exceeded.");
    expect(isAlreadyExists(new Error("nope"))).toBe(false);
  });
});
