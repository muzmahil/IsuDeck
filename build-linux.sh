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
        libudev-dev \
        xdotool \
        xdg-utils \
        playerctl \
        brightnessctl \
        pulseaudio-utils \
        trash-cli
elif command -v dnf &> /dev/null; then
    sudo dnf install -y \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        openssl-devel \
        alsa-lib-devel \
        systemd-devel \
        xdotool \
        xdg-utils \
        playerctl \
        brightnessctl \
        pulseaudio-utils \
        trash-cli
elif command -v pacman &> /dev/null; then
    sudo pacman -S --needed --noconfirm \
        webkit2gtk-4.1 \
        gtk3 \
        libappindicator-gtk3 \
        librsvg \
        openssl \
        alsa-lib \
        systemd \
        xdotool \
        xdg-utils \
        playerctl \
        brightnessctl \
        libpulse \
        trash-cli
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

# 3. Rust & Cargo Check and Auto-Install (Requires modern Rust >= 1.80)
echo -e "\n\033[1;36m[3/5] Checking Rust and Cargo...\033[0m"
export PATH="$HOME/.cargo/bin:/root/.cargo/bin:$PATH"
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
elif [ -f "/root/.cargo/env" ]; then
    source "/root/.cargo/env"
fi

CARGO_VER=$(cargo --version 2>/dev/null | awk '{print $2}' || echo "0.0.0")
CARGO_MINOR=$(echo "$CARGO_VER" | cut -d'.' -f2 || echo "0")

if ! command -v cargo &> /dev/null || ! [[ "$CARGO_MINOR" =~ ^[0-9]+$ ]] || [ "$CARGO_MINOR" -lt 80 ]; then
    echo "⚠️ Upgrading Rust to modern stable (current: $CARGO_VER, requires >= 1.80)..."
    if command -v rustup &> /dev/null; then
        rustup default stable
        rustup update stable
    else
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable || \
        (sudo apt-get install -y rustup 2>/dev/null && rustup default stable) || true
    fi
    export PATH="$HOME/.cargo/bin:/root/.cargo/bin:$PATH"
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
fi
echo "✓ Cargo version: $(cargo --version 2>/dev/null || echo 'not found')"

# 4. Hardware Input Permissions (/dev/input evdev group & udev rules)
echo -e "\n\033[1;36m[4/5] Checking /dev/input permissions for hardware isolation...\033[0m"
if ! groups "$USER" | grep &>/dev/null '\binput\b'; then
    echo "Adding user '$USER' to 'input' group for hardware keystroke capture..."
    sudo usermod -aG input "$USER"
    echo -e "\033[1;33m[NOTE] You may need to log out and log back in once for 'input' group changes to take full effect in your active session.\033[0m"
else
    echo "✓ User '$USER' is already a member of the 'input' group."
fi

# Ensure /dev/input/event* has read access for the input group via udev rule
UDEV_RULE_FILE="/etc/udev/rules.d/99-isudeck-input.rules"
if [ ! -f "$UDEV_RULE_FILE" ]; then
    echo "Creating udev rule for /dev/input event access..."
    echo 'KERNEL=="event*", SUBSYSTEM=="input", MODE="0660", GROUP="input"' | sudo tee "$UDEV_RULE_FILE" > /dev/null
    sudo udevadm control --reload-rules && sudo udevadm trigger || true
fi

# Also set permissions for existing event devices in the current session so it works immediately
sudo chmod -R g+r /dev/input 2>/dev/null || true

# 5. Build Steps
echo -e "\n\033[1;36m[5/5] Building IsuDeck...\033[0m"

# Install fast linker if available (significantly speeds up Rust link time on Linux)
if command -v mold &> /dev/null; then
    echo "✓ Using mold linker (fast)"
    export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
elif command -v lld &> /dev/null; then
    echo "✓ Using lld linker (fast)"
    export RUSTFLAGS="-C link-arg=-fuse-ld=lld"
else
    echo "ℹ️  No fast linker found (optional: sudo apt install mold)"
fi

# Use all available CPU cores for compilation
export CARGO_BUILD_JOBS=$(nproc)
echo "✓ Using $CARGO_BUILD_JOBS CPU cores for compilation"

echo "--> Installing Next.js frontend dependencies..."
cd "$SCRIPT_DIR/isu-deck-ui"
# npm ci is faster and reproducible (uses lockfile exactly)
if [ -f "package-lock.json" ]; then
    npm ci --prefer-offline 2>/dev/null || npm install
else
    npm install
fi

echo "--> Building Next.js frontend (static export)..."
NODE_ENV=production npm run build

echo "--> Compiling native Linux release binary (optimized)..."
cd "$SCRIPT_DIR/isu-deck-ui/src-tauri"
cargo build --release

BIN_SRC="$SCRIPT_DIR/isu-deck-ui/src-tauri/target/release/app"
BIN_DEST="$SCRIPT_DIR/IsuDeck-Linux-x64"

if [ -f "$BIN_SRC" ]; then
    cp "$BIN_SRC" "$BIN_DEST"
    chmod +x "$BIN_DEST"
    # Show binary size for info
    BIN_SIZE=$(du -sh "$BIN_DEST" | cut -f1)
    echo -e "\n\033[1;32m========================================================\033[0m"
    echo -e "\033[1;32m SUCCESS: Linux native executable created!\033[0m"
    echo -e "\033[1;32m Executable: $BIN_DEST ($BIN_SIZE)\033[0m"
    echo -e "\033[1;32m To launch, run:\033[0m"
    echo -e "\033[1;33m   ./IsuDeck-Linux-x64\033[0m"
    echo -e "\033[1;32m========================================================\033[0m"
else
    echo -e "\033[1;31m[ERROR] Build output not found: $BIN_SRC\033[0m"
    exit 1
fi
