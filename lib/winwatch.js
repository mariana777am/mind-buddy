// Windows helper: one long-running PowerShell process that answers
//   win   → {"app":"OUTLOOK","title":"RE: delivery - Outlook"}   (the window you're in)
//   copy  → presses Ctrl+C in that window (after you let go of the hotkey)
//   paste → presses Ctrl+V
// Nothing here reads keystrokes; it only asks Windows which window is in front.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PS = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class BuddyW {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static bool Down(int k){ return (GetAsyncKeyState(k) & 0x8000) != 0; }
  public static void WaitRelease(){ for(int i=0;i<60;i++){ if(!Down(0x11)&&!Down(0x12)&&!Down(0x10)&&!Down(0x5B)) return; System.Threading.Thread.Sleep(25);} }
  public static void Combo(byte key){ WaitRelease(); keybd_event(0x11,0,0,UIntPtr.Zero); keybd_event(key,0,0,UIntPtr.Zero); keybd_event(key,0,2,UIntPtr.Zero); keybd_event(0x11,0,2,UIntPtr.Zero); }
}
"@
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line -eq 'win') {
    $h = [BuddyW]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder 512
    [void][BuddyW]::GetWindowText($h, $sb, 512); $p = 0; [void][BuddyW]::GetWindowThreadProcessId($h, [ref]$p)
    $name = (Get-Process -Id $p).ProcessName
    [Console]::Out.WriteLine((@{ app = "$name"; title = $sb.ToString() } | ConvertTo-Json -Compress))
  } elseif ($line -eq 'copy') { [BuddyW]::Combo(0x43); [Console]::Out.WriteLine('{"ok":true}') }
  elseif ($line -eq 'paste') { [BuddyW]::Combo(0x56); [Console]::Out.WriteLine('{"ok":true}') }
  else { [Console]::Out.WriteLine('{}') }
}
`;

export function createWinWatch({ log = () => {} } = {}){
  if (process.platform !== 'win32') return { available: false, win: async () => null, copy: async () => {}, paste: async () => {}, stop(){} };
  const file = path.join(os.tmpdir(), 'minds-buddy-helper.ps1');
  writeFileSync(file, '﻿' + PS, 'utf8');
  let ps = null, buf = '', waiting = [];
  function start(){
    ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true });
    ps.stdout.setEncoding('utf8');
    ps.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0){ const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); const w = waiting.shift(); if (w) { try { w(JSON.parse(line)); } catch { w(null); } } } });
    ps.on('exit', () => { ps = null; waiting.splice(0).forEach(w => w(null)); });
    ps.stderr.on('data', d => log('[helper]', String(d).slice(0, 200)));
  }
  function cmd(c, timeout = 3000){
    if (!ps) start();
    return new Promise(res => { let done = false; const fin = v => { if (!done){ done = true; res(v); } };
      waiting.push(fin); setTimeout(() => { const i = waiting.indexOf(fin); if (i >= 0) { waiting.splice(i, 1); try { ps?.kill(); } catch (_) {} } fin(null); }, timeout); /* a late answer would get out of step, so the helper restarts */ ps.stdin.write(c + '\n'); });
  }
  return { available: true, win: () => cmd('win'), copy: () => cmd('copy'), paste: () => cmd('paste'), stop(){ try { ps?.kill(); } catch (_) {} } };
}
