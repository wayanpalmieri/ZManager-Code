import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import os from "os";

// Opens the OS-native folder picker and returns the chosen absolute path.
// Runs only on the local machine (the /api/* proxy guard rejects non-loopback
// requests), and no user input is passed to the shell — the picker's argv is
// static. The chosen path is not trusted on its own; the PUT /api/settings
// handler still realpath-resolves and rejects symlinks before persisting it.
export async function POST() {
  const platform = os.platform();

  if (platform === "darwin") {
    // AppleScript: show a folder chooser dialog and print POSIX path.
    // "with prompt" text is a static literal — no injection surface.
    const res = spawnSync(
      "osascript",
      ["-e", 'POSIX path of (choose folder with prompt "Choose your projects folder")'],
      { encoding: "utf-8" }
    );
    if (res.status !== 0) {
      // exit 1 = user cancelled, which we surface as a 204 so the UI can
      // silently keep the current value instead of flashing an error.
      return new NextResponse(null, { status: 204 });
    }
    // osascript appends a trailing newline and an extra "/" on folders.
    const picked = res.stdout.trim().replace(/\/$/, "");
    return NextResponse.json({ path: picked });
  }

  if (platform === "linux") {
    const res = spawnSync(
      "zenity",
      ["--file-selection", "--directory", "--title=Choose your projects folder"],
      { encoding: "utf-8" }
    );
    if (res.status !== 0) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ path: res.stdout.trim() });
  }

  if (platform === "win32") {
    // PowerShell FolderBrowserDialog. The script is a static literal.
    const script =
      "Add-Type -AssemblyName System.Windows.Forms; " +
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog; " +
      "if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }";
    const res = spawnSync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf-8" }
    );
    if (res.status !== 0) return new NextResponse(null, { status: 204 });
    const picked = res.stdout.trim();
    if (!picked) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ path: picked });
  }

  return NextResponse.json(
    { error: `Native folder picker not supported on ${platform}` },
    { status: 501 }
  );
}
