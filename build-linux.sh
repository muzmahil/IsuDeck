#!/usr/bin/env bash
# ==============================================================================
# IsuDeck Linux Native Build & Package Script
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "\033[1;36m[1/4] Checking and installing Linux system dependencies...\033[0m"
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

echo -e "\033[1;36m[2/4] Ensuring user has permissions for /dev/input (evdev)...\033[0m"
if ! groups "$USER" | grep &>/dev/null '\binput\b'; then
    echo "Adding $USER to 'input' group for secondary keyboard hardware capture..."
    sudo usermod -aG input "$USER"
    echo -e "\033[1;33m[NOTE] You may need to log out and log back in for 'input' group changes to take effect.\033[0m"
fi

echo -e "\033[1;36m[3/4] Building Next.js Frontend...\033[0m"
cd "$SCRIPT_DIR/isu-deck-ui"
npm install
npm run build

echo -e "\033[1;36m[4/4] Compiling Native Linux Tauri Release Binary...\033[0m"
cd "$SCRIPT_DIR/isu-deck-ui/src-tauri"
cargo build --release

BIN_SRC="$SCRIPT_DIR/isu-deck-ui/src-tauri/target/release/app"
BIN_DEST="$SCRIPT_DIR/IsuDeck-Linux-x64"

if [ -f "$BIN_SRC" ]; then
    cp "$BIN_SRC" "$BIN_DEST"
    chmod +x "$BIN_DEST"
    echo -e "\033[1;32m========================================================\033[0m"
    echo -e "\033[1;32mSUCCESS: Linux binary generated at: $BIN_DEST\033[0m"
    echo -e "\033[1;32mRun with: ./IsuDeck-Linux-x64\033[0m"
    echo -e "\033[1;32m========================================================\033[0m"
fi
