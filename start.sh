#!/bin/sh

echo " Starting Tailscale + ECU Proxy..."

# Start tailscaled in background
echo " Starting tailscaled..."
./tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &

# Wait a moment for tailscaled to start
sleep 2

# Authenticate and bring up tailscale
echo " Authenticating with Tailscale..."
./tailscale up --authkey=$TAILSCALE_AUTHKEY --hostname=$TAILSCALE_HOSTNAME $TAILSCALE_ADDITIONAL_ARGS

# Start ECU proxy server
echo " Starting ECU Proxy Server..."
node ecu-proxy.js &

# Keep the container running
echo " All services started. Keeping container alive..."
wait
