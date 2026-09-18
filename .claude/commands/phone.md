---
description: Serve the build for the phone on this wifi
---

```bash
python3 build.py
python3 -m http.server 8000 --directory dist
```

Then print the LAN URL to open on the Pixel — find the machine's address with
`ipconfig` (Windows) or `ip addr` (Linux) and give me `http://<address>:8000`.

Note what will *not* work over plain http on the LAN: the service worker will not register,
so there is no installable shell and no offline cache. Fullscreen, the wake lock, WebGL lens
correction, gamepad and tilt all work fine. Install from the deployed Pages URL when you want
the home-screen icon.
