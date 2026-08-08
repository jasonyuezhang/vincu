---
title: Connectivity
description: Connect a Vincu client to your daemon through the relay or Tailscale.
nav: Connectivity
order: 4
category: Getting started
---

# Connectivity

Your Vincu app connects to the daemon running on your computer or server. You can connect through the Vincu relay or directly with Tailscale.

This is client-to-daemon transport. If you are looking for the service that starts agents from GitHub, Slack, and Discord events, that is [Hub](/docs/hub).

- [Vincu relay](#vincu-relay)
- [Tailscale](#tailscale)

## Vincu relay

The relay works without Tailscale, port forwarding, or network configuration. Traffic is end-to-end encrypted.

Relay is disabled until you enable it.

### Enable relay from Vincu Desktop

1. Open **Settings → your host → Pair a device**.
2. Select **Enable relay**.
3. Scan the QR code with Vincu on your phone, or copy the pairing link and paste it into the phone app.

### Enable relay from the CLI

Run:

```bash
vincu daemon pair
```

Confirm when prompted. Vincu prints a QR code and pairing link. Scan the QR code with Vincu on your phone, or choose **Paste pairing link** in the phone app.

## Tailscale

Install [Tailscale](https://tailscale.com/download) on the daemon machine and your phone. Sign in to the same tailnet on both devices.

### 1. Find the daemon machine's Tailscale IP

Run this on the daemon machine:

```bash
tailscale ip -4
```

Copy the address it prints. The example below uses `100.101.102.103`.

### 2. Configure the daemon

Open `~/.vincu/config.json` and set `daemon.listen` to the Tailscale IP:

```json
{
  "$schema": "https://vincu.sh/schemas/vincu.config.v1.json",
  "version": 1,
  "daemon": {
    "listen": "100.101.102.103:6767"
  }
}
```

Keep the other settings already in the file. If it has a `daemon` object, add `listen` inside that object.

To restrict access with a password, see [Password authentication](/docs/configuration#password-authentication).

Restart the daemon:

```bash
vincu daemon restart
```

If Vincu Desktop manages the daemon, use **Settings → your host → Overview → Restart daemon**.

### 3. Connect the phone app

1. Connect Tailscale on your phone.
2. Open Vincu and go to **Settings → Add host → Direct connection**.
3. Enter the Tailscale IP in **Host**.
4. Enter `6767` in **Port**.
5. Leave **Use SSL** off and select **Connect**.

If the host was already paired through the relay, Vincu adds the direct connection to the same host.

## Troubleshooting

- **Connection timed out:** Check that Tailscale is connected on both devices and that you used the daemon machine's Tailscale IP.
- **Connection refused:** Run `vincu daemon status` and confirm the daemon is running on the configured IP and port.
- **Config change has no effect:** Restart the daemon after editing `config.json`.
