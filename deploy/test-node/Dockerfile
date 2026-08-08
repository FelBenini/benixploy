FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssh-server curl ca-certificates gnupg lsb-release && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    echo 'root:password' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    mkdir -p /var/run/sshd /root/.ssh && \
    chmod 700 /root/.ssh

# Pre-install Docker CE so install.sh skips the download step.
# The docker group is created here so usermod -aG docker in
# install.sh works (even though the daemon isn't running).
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-compose-plugin && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D", "-e"]