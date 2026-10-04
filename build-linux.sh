#!/usr/bin/env bash
# ==============================================================================
# IsuDeck Linux Native Automated Build & Setup Script
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "\033[1;36m========================================================\033[0m"
echo -e "\033[1;36m       IsuDeck Linux Automated Build & Setup            \033[0m"
echo -e "\033[1;36m========================================================\033[0m"

# 1. Sistem Paket Yöneticisi Bağımlılıkları
echo -e "\n\033[1;36m[1/5] Checking and installing Linux system libraries...\033[0m"
if command -v apt-get &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        build-essential \
        curl \
        wget \
        file \
        libssl-dev \
        libasound2-dev \
        libudev-dev
elif command -v dnf &> /dev/null; then
    sudo dnf install -y \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        openssl-devel \
        alsa-lib-devel \
        systemd-devel
elif command -v pacman &> /dev/null; then
    sudo pacman -S --needed --noconfirm \
        webkit2gtk-4.1 \
        gtk3 \
        libappindicator-gtk3 \
        librsvg \
        openssl \
        alsa-lib \
        systemd
fi

# 2. Node.js & npm Kontrolü ve Otomatik Kurulumu
echo -e "\n\033[1;36m[2/5] Checking Node.js and npm...\033[0m"
if ! command -v npm &> /dev/null; then
    echo "⚠️ npm bulunamadı. Node.js ve npm otomatik kuruluyor..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -y
        sudo apt-get install -y nodejs npm
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs npm
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --needed --noconfirm nodejs npm
    else
        echo -e "\033[1;31m[HATA] Paket yöneticisi bulunamadı. Lütfen Node.js ve npm'i manuel kurun.\033[0m"
        exit 1
    fi
fi
echo "✓ Node.js sürümü: $(node -v)"
echo "✓ npm sürümü: $(npm -v)"

# 3. Rust & Cargo Kontrolü ve Otomatik Kurulumu
echo -e "\n\033[1;36m[3/5] Checking Rust and Cargo...\033[0m"
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

if ! command -v cargo &> /dev/null; then
    echo "⚠️ Cargo bulunamadı. Rust otomatik kuruluyor..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo "✓ Cargo sürümü: $(cargo -v)"

# 4. Donanım İzni (/dev/input evdev yetkisi)
echo -e "\n\033[1;36m[4/5] Checking /dev/input permissions for hardware isolation...\033[0m"
if ! groups "$USER" | grep &>/dev/null '\binput\b'; then
    echo "Kullanıcı '$USER', 'input' grubuna ekleniyor (donanım izolasyonu için)..."
    sudo usermod -aG input "$USER"
    echo -e "\033[1;33m[NOT] Değişikliğin tam geçerli olması için oturumu bir kez kapatıp açmanız gerekebilir.\033[0m"
else
    echo "✓ '$USER' kullanıcısı zaten 'input' grubunda."
fi

# 5. Derleme Aşaması
echo -e "\n\033[1;36m[5/5] Building IsuDeck...\033[0m"

echo "--> Frontend bağımlılıkları yükleniyor ve derleniyor..."
cd "$SCRIPT_DIR/isu-deck-ui"
npm install
npm run build

echo "--> Linux native release binary derleniyor..."
cd "$SCRIPT_DIR/isu-deck-ui/src-tauri"
cargo build --release

BIN_SRC="$SCRIPT_DIR/isu-deck-ui/src-tauri/target/release/app"
BIN_DEST="$SCRIPT_DIR/IsuDeck-Linux-x64"

if [ -f "$BIN_SRC" ]; then
    cp "$BIN_SRC" "$BIN_DEST"
    chmod +x "$BIN_DEST"
    echo -e "\n\033[1;32m========================================================\033[0m"
    echo -e "\033[1;32m BAŞARILI: Linux çalıştırılabilir dosyası hazırlandı!\033[0m"
    echo -e "\033[1;32m Dosya Konumu: $BIN_DEST\033[0m"
    echo -e "\033[1;32m Çalıştırmak için:\033[0m"
    echo -e "\033[1;33m   ./IsuDeck-Linux-x64\033[0m"
    echo -e "\033[1;32m========================================================\033[0m"
else
    echo -e "\033[1;31m[HATA] Derleme çıktısı bulunamadı: $BIN_SRC\033[0m"
    exit 1
fi
