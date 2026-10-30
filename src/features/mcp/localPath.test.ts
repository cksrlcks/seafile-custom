import { describe, expect, it } from "vitest";
import { blockedLocalPath, plainFileName } from "./localPath";

describe("blockedLocalPath", () => {
  it.each([
    "/Users/kim/Documents/보고서.docx",
    "/Users/kim/project/u-drive",
    "/private/tmp/claude-501/work",
    "/Volumes/USB/a.pdf",
    String.raw`C:\Users\kim\Desktop\a.xlsx`,
    "D:/work/견적서.hwp",
    "/home/kim/docs/a.txt",
  ])("허용: %s", (p) => expect(blockedLocalPath(p)).toBeNull());

  it.each([
    ["/Users/kim/.ssh/id_rsa", "숨김"],
    ["/Users/kim/project/.env", "숨김"],
    ["/Users/kim/project/.git/hooks", "숨김"],
    ["/Users/kim/.zshrc", "숨김"],
    ["/Users/kim/Documents/../.aws/credentials", "숨김"],
    ["/Users/kim/Library/LaunchAgents", "설정"],
    ["/Users/kim/library/Application Support/com.chang.seadrive/mcp.json", "설정"],
    ["/Library/LaunchDaemons/x.plist", "설정"],
    ["/etc/passwd", "설정"],
    ["/private/etc/hosts", "설정"],
    [String.raw`C:\Users\kim\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`, "설정"],
    [String.raw`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\a.bat`, "설정"],
    [String.raw`C:\Windows\System32\drivers\etc\hosts`, "설정"],
    [String.raw`c:\program files\app\x.exe`, "설정"],
    [String.raw`\\attacker\share\x`, "네트워크"],
    ["relative/path.txt", "절대 경로"],
    ["~/Documents/a.txt", "절대 경로"],
  ])("막음: %s", (p, why) => expect(blockedLocalPath(p)).toContain(why));
});

describe("plainFileName", () => {
  it("경로를 떼고 이름만", () => {
    expect(plainFileName("보고서.docx")).toBe("보고서.docx");
    expect(plainFileName("../../Library/LaunchAgents/x.plist")).toBe("x.plist");
    expect(plainFileName(String.raw`..\..\AppData\x.bat`)).toBe("x.bat");
    expect(plainFileName("..")).toBeNull();
    expect(plainFileName("dir/")).toBeNull();
  });
});
