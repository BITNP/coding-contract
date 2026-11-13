#!/bin/sh
set -eu
export DEBIAN_FRONTEND=noninteractive

if [ "$(uname -s)" != Linux ] || [ "$(id -u)" != 0 ]; then
  echo '请在 Debian 13 上以 root 身份运行（sudo sh server/install.sh）。' >&2
  exit 1
fi
. /etc/os-release
if [ "$ID:$VERSION_ID" != debian:13 ]; then
  echo '当前安装脚本支持 Debian 13。' >&2
  exit 1
fi
arch=$(dpkg --print-architecture)
case "$arch" in
  arm64) swift_platform=debian13-aarch64 ;;
  amd64) swift_platform=debian13 ;;
  *) echo "不支持的架构：$arch" >&2; exit 1 ;;
esac

# 只有脚本变化或上次安装未完成时才安装，日常启动不访问软件源。
state_dir=/var/lib/pioneer-judge
script_hash=$(sha256sum "$0" | cut -d ' ' -f 1)
if [ -f "$state_dir/provision.sha256" ] && [ "$(cat "$state_dir/provision.sha256")" = "$script_hash" ]; then
  exit 0
fi

apt-get -o Acquire::Retries=3 update
apt-get install -y --no-install-recommends \
  clang g++ python3-clang python3-pygments curl ca-certificates gnupg \
  default-jdk-headless nodejs node-typescript libnode-dev golang-go rustc \
  mono-mcs kotlin php-cli ruby lua5.4 perl r-base-core \
  binutils-gold git libcurl4-openssl-dev libedit-dev libicu-dev \
  libncurses-dev libpython3-dev libsqlite3-dev libstdc++-14-dev \
  libxml2-dev pkg-config tzdata unzip uuid-dev zip rsync xz-utils

# Swift 官方 Debian 工具链，使用与服务器架构匹配的发布包。
swift_version=6.4.2
swift_dir=/usr/local/swift
if [ ! -x "$swift_dir/usr/bin/swiftc" ]; then
  swift_package="swift-${swift_version}-RELEASE-${swift_platform}"
  swift_url="https://download.swift.org/swift-${swift_version}-release/${swift_platform}/swift-${swift_version}-RELEASE/${swift_package}.tar.gz"
  swift_tmp=$(mktemp -d /usr/local/.swift.XXXXXX)
  trap 'rm -rf "$swift_tmp"' EXIT
  curl -fsSL --compressed --retry 3 "$swift_url.sig" -o "$swift_tmp/swift.tar.gz.sig"
  curl -fsSL --compressed https://www.swift.org/keys/all-keys.asc -o "$swift_tmp/keys.asc"
  gpg --batch --homedir "$swift_tmp" --import "$swift_tmp/keys.asc"
  mkdir -p /var/cache/pioneer-judge
  swift_archive="/var/cache/pioneer-judge/${swift_package}.tar.gz"
  curl -fL --retry 3 -C - "$swift_url" -o "$swift_archive"
  gpg --batch --homedir "$swift_tmp" --verify "$swift_tmp/swift.tar.gz.sig" "$swift_archive"
  mkdir -p "$swift_tmp/toolchain"
  tar -xzf "$swift_archive" -C "$swift_tmp/toolchain" --strip-components=1
  mv "$swift_tmp/toolchain" "$swift_dir"
  rm "$swift_archive"
fi

curl -fsSL --retry 3 "https://github.com/criyle/go-judge/releases/download/v1.14.0/go-judge_1.14.0_linux_${arch}" -o /usr/local/bin/go-judge.new
chmod +x /usr/local/bin/go-judge.new
mv /usr/local/bin/go-judge.new /usr/local/bin/go-judge
# 运行时的发行版配置采用与库文件相同的只读挂载。
{
  echo 'mount:'
  for path in /bin /lib /lib64 /usr /etc/ld.so.cache /etc/alternatives /etc/mono /etc/java-21-openjdk /etc/R; do
    [ -e "$path" ] || continue
    printf '  - {type: bind, source: %s, target: %s, readonly: true}\n' "$path" "$path"
  done
  for path in /dev/null /dev/urandom /dev/random /dev/zero /dev/full; do
    printf '  - {type: bind, source: %s, target: %s}\n' "$path" "$path"
  done
  cat <<'EOF'
  - {type: tmpfs, target: /w, data: 'size=512m,nr_inodes=32k'}
  - {type: tmpfs, target: /tmp, data: 'size=512m,nr_inodes=32k'}
proc: true
workDir: /w
uid: 1536
gid: 1536
symLink:
  - {linkPath: /dev/fd, target: /proc/self/fd}
  - {linkPath: /dev/stdin, target: /proc/self/fd/0}
  - {linkPath: /dev/stdout, target: /proc/self/fd/1}
  - {linkPath: /dev/stderr, target: /proc/self/fd/2}
EOF
} > /etc/pioneer-judge-mount.yaml

cat > /etc/systemd/system/go-judge.service <<'EOF'
[Unit]
Description=Pioneer code execution sandbox
After=network.target

[Service]
ExecStart=/usr/local/bin/go-judge -http-addr 127.0.0.1:5050 -parallelism 1 -mount-conf /etc/pioneer-judge-mount.yaml

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable go-judge
systemctl restart go-judge
mkdir -p "$state_dir"
printf '%s\n' "$script_hash" > "$state_dir/provision.sha256"
