FROM alpine:3.18.3

# Install Node.js for ECU proxy
RUN apk add --no-cache nodejs npm

# Setup tailscale
ENV TAILSCALE_VERSION "latest"
ENV TAILSCALE_HOSTNAME "railway-app"
ENV TAILSCALE_ADDITIONAL_ARGS ""

RUN wget https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_amd64.tgz && \
  tar xzf tailscale_${TAILSCALE_VERSION}_amd64.tgz --strip-components=1

RUN apk update && apk add ca-certificates iptables ip6tables && rm -rf /var/cache/apk/*

RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

# Copy our files
COPY start.sh ./
COPY ecu-proxy.js ./

RUN chmod +x ./start.sh

CMD ["./start.sh"]
