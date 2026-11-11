# Privacy

**Creator Board collects nothing and sends nothing.**

- **No account, no sign-up, no analytics, no ads, no crash reports, no automatic updates.**
- **Your data stays on your computer**, in one plain file you can open in Notepad. See "Where is my data?" in the [README](README.md).
- **No internet connections.** The app starts a tiny web server bound to `127.0.0.1` (your own computer only; nothing on your network or the internet can reach it) and shows it inside a window. The code has no outbound requests; you can confirm this in [`server.js`](server.js) and [`electron-main.js`](electron-main.js).
- **Optional "extra backup copy"** only copies your file into a folder you type (for example a USB stick or a Google Drive folder on your PC). The app itself never talks to those services.

## Check it yourself (about 2 minutes)
1. **Firewall test:** in Windows Defender Firewall, add an outbound **Block** rule for the installed `Creator Board.exe`. The app keeps working exactly the same.
2. **Network test:** open PowerShell and run `Get-NetTCPConnection -OwningProcess (Get-Process "Creator Board").Id | Where-Object { $_.RemoteAddress -notin '127.0.0.1','::1','0.0.0.0','::' }`. It should list nothing.
3. **Read the code:** the whole app is a few small files.

## Your responsibility
Your data is as safe as the computer it lives on. Use the optional extra backup folder, and keep your computer secure.
