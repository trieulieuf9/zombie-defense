#!/bin/sh
# Serve this folder. On the Mac open http://localhost:8138 ; on the iPad use the LAN address printed below.
cd "$(dirname "$0")"
IP=""
for i in en0 en1 en2 en3 en4 en5; do
  IP=$(ipconfig getifaddr "$i" 2>/dev/null)
  [ -n "$IP" ] && break
done
[ -z "$IP" ] && IP=$(ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')
echo "Open on this Mac:  http://localhost:8138"
if [ -n "$IP" ]; then echo "Open on the iPad (same Wi-Fi):  http://$IP:8138"; else echo "No network address found - connect to Wi-Fi to use the iPad."; fi
echo "Press Ctrl+C to stop."
exec python3 serve.py 8138
