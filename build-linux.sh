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

# 1. System Package Manager Dependencies
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

# 2. Node.js & npm Check and Auto-Install (Requires Node.js >= 20.9.0)
echo -e "\n\033[1;36m[2/5] Checking Node.js and npm...\033[0m"
export PATH="/usr/local/bin:$PATH"

NODE_MAJOR=0
if command -v node &> /dev/null; then
    NODE_MAJOR=$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v' || echo "0")
fi

if ! command -v npm &> /dev/null || [ "$NODE_MAJOR" -lt 20 ]; then
    echo "⚠️ Node.js >= 20.9.0 is required for Next.js (current: $(node -v 2>/dev/null || echo 'none')). Upgrading Node.js..."
    if command -v npm &> /dev/null; then
        sudo npm install -g n
        sudo n 20
        export PATH="/usr/local/bin:$PATH"
        hash -r 2>/dev/null || true
    elif command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs npm
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --needed --noconfirm nodejs npm
    fi
fi
echo "✓ Node.js version: $(node -v)"
echo "✓ npm version: $(npm -v)"

# 3. Rust & Cargo Check and Auto-Install
echo -e "\n\033[1;36m[3/5] Checking Rust and Cargo...\033[0m"
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

if ! command -v cargo &> /dev/null; then
    echo "⚠️ Cargo not found. Installing Rust and Cargo..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -y
        sudo apt-get install -y cargo rustc || {
            echo "Package manager fallback: trying rustup..."
            curl -sSf https://sh.rustup.rs | sh -s -- -y || true
        }
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y cargo rust
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --needed --noconfirm cargo rust
    fi
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi
fi

if ! command -v cargo &> /dev/null; then
    echo -e "\033[1;31m[ERROR] Cargo could not be found. Please install Rust manually via: sudo apt install cargo\033[0m"
    exit 1
fi
echo "✓ Cargo version: $(cargo -v)"

# 4. Hardware Input Permissions (/dev/input evdev group)
echo -e "\n\033[1;36m[4/5] Checking /dev/input permissions for hardware isolation...\033[0m"
if ! groups "$USER" | grep &>/dev/null '\binput\b'; then
    echo "Adding user '$USER' to 'input' group for secondary keyboard hardware capture..."
    sudo usermod -aG input "$USER"
    echo -e "\033[1;33m[NOTE] You may need to log out and log back in once for 'input' group changes to take full effect.\033[0m"
else
    echo "✓ User '$USER' is already a member of the 'input' group."
fi

# 5. Build Steps
echo -e "\n\033[1;36m[5/5] Building IsuDeck...\033[0m"

echo "--> Installing and compiling Next.js frontend..."
cd "$SCRIPT_DIR/isu-deck-ui"
npm install
npm run build

echo "--> Compiling native Linux release binary..."
cd "$SCRIPT_DIR/isu-deck-ui/src-tauri"
cargo build --release

BIN_SRC="$SCRIPT_DIR/isu-deck-ui/src-tauri/target/release/app"
BIN_DEST="$SCRIPT_DIR/IsuDeck-Linux-x64"

if [ -f "$BIN_SRC" ]; then
    cp "$BIN_SRC" "$BIN_DEST"
    chmod +x "$BIN_DEST"
    echo -e "\n\033[1;32m========================================================\033[0m"
    echo -e "\033[1;32m SUCCESS: Linux native executable created!\033[0m"
    echo -e "\033[1;32m Executable Path: $BIN_DEST\033[0m"
    echo -e "\033[1;32m To launch, run:\033[0m"
    echo -e "\033[1;33m   ./IsuDeck-Linux-x64\033[0m"
    echo -e "\033[1;32m========================================================\033[0m"
else
    echo -e "\033[1;31m[ERROR] Build output not found: $BIN_SRC\033[0m"
    exit 1
fi
