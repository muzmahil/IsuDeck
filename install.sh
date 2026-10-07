#!/usr/bin/env bash
# ==============================================================================
# IsuDeck One-Line Web Installer for Linux
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/muzmahil/IsuDeck/main/install.sh | bash
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}             IsuDeck Linux Automated Installer          ${NC}"
echo -e "${CYAN}========================================================${NC}"

# Target installation directory inside user's home
INSTALL_DIR="$HOME/IsuDeck"
BIN_LINK="/usr/local/bin/isudeck"
DESKTOP_DIR="$HOME/.local/share/applications"
REPO_URL="https://github.com/muzmahil/IsuDeck.git"

# 1. Install necessary system runtime dependencies
echo -e "\n${CYAN}[1/5] Installing system runtime dependencies...${NC}"
if command -v apt-get &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        libasound2-dev \
        libudev-dev \
        xdotool \
        xdg-utils \
        playerctl \
        brightnessctl \
        pulseaudio-utils \
        trash-cli \
        git \
        curl
elif command -v dnf &> /dev/null; then
    sudo dnf install -y \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        alsa-lib-devel \
        systemd-devel \
        xdotool \
        xdg-utils \
        playerctl \
        brightnessctl \
        pulseaudio-utils \
        trash-cli \
        git \
        curl
elif command -v pacman &> /dev/null; then
    sudo pacman -S --needed --noconfirm \
        webkit2gtk-4.1 \
        gtk3 \
        libappindicator-gtk3 \
        librsvg \
        alsa-lib \
        systemd \
        xdotool \
        xdg-utils \
        playerctl \
        brightnessctl \
        libpulse \
        trash-cli \
        git \
        curl
fi

# 2. Hardware Keystroke Input Permissions (evdev & udev)
echo -e "\n${CYAN}[2/5] Configuring /dev/input permissions...${NC}"
if ! groups "$USER" | grep &>/dev/null '\binput\b'; then
    echo "Adding user '$USER' to 'input' group..."
    sudo usermod -aG input "$USER"
fi

UDEV_RULE_FILE="/etc/udev/rules.d/99-isudeck-input.rules"
if [ ! -f "$UDEV_RULE_FILE" ]; then
    echo "Configuring udev rules for keystroke capture..."
    echo 'KERNEL=="event*", SUBSYSTEM=="input", MODE="0660", GROUP="input"' | sudo tee "$UDEV_RULE_FILE" > /dev/null
    sudo udevadm control --reload-rules && sudo udevadm trigger || true
fi
sudo chmod -R g+r /dev/input 2>/dev/null || true

# 3. Setup IsuDeck Directory & Files
echo -e "\n${CYAN}[3/5] Setting up IsuDeck in '$INSTALL_DIR'...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating existing installation in '$INSTALL_DIR'..."
    cd "$INSTALL_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    echo "Cloning IsuDeck to '$INSTALL_DIR'..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Build binary
echo -e "\n${YELLOW}Building IsuDeck binary via build-linux.sh...${NC}"
chmod +x "$INSTALL_DIR/build-linux.sh"
"$INSTALL_DIR/build-linux.sh"

# Ensure executable permissions
chmod +x "$INSTALL_DIR/IsuDeck-Linux-x64"

# 4. Terminal Global Command Launcher (isudeck)
echo -e "\n${CYAN}[4/5] Creating terminal command 'isudeck'...${NC}"
LAUNCHER_WRAPPER="/tmp/isudeck-launcher"
cat << 'EOF' > "$LAUNCHER_WRAPPER"
#!/usr/bin/env bash
# ==============================================================================
# IsuDeck Terminal Command Launcher
# ==============================================================================
APP_DIR="$HOME/IsuDeck"

case "$1" in
    update|--update)
        if [ -f "$APP_DIR/update.sh" ]; then
            exec bash "$APP_DIR/update.sh"
        elif [ -d "$APP_DIR/.git" ]; then
            cd "$APP_DIR"
            git fetch origin main
            git reset --hard origin/main
            exec bash "$APP_DIR/build-linux.sh"
        else
            exec bash -c "curl -fsSL https://raw.githubusercontent.com/muzmahil/IsuDeck/main/install.sh | bash"
        fi
        ;;
    uninstall|--uninstall)
        shift
        if [ -f "$APP_DIR/uninstall.sh" ]; then
            exec bash "$APP_DIR/uninstall.sh" "$@"
        else
            exec bash -c "curl -fsSL https://raw.githubusercontent.com/muzmahil/IsuDeck/main/uninstall.sh | bash"
        fi
        ;;
    help|--help|-h)
        echo "IsuDeck CLI commands:"
        echo "  isudeck             - Launch IsuDeck application"
        echo "  isudeck update      - Update IsuDeck to latest version and rebuild"
        echo "  isudeck uninstall   - Completely uninstall IsuDeck from your system"
        echo "  isudeck --help      - Show this help message"
        exit 0
        ;;
    *)
        export WEBKIT_DISABLE_COMPOSITING_MODE=1
        export WEBKIT_DISABLE_DMABUF_RENDERER=1

        if [ ! -f "$APP_DIR/IsuDeck-Linux-x64" ]; then
            echo "[ERROR] IsuDeck executable not found at $APP_DIR/IsuDeck-Linux-x64"
            echo "Run 'isudeck update' to build the application."
            exit 1
        fi

        cd "$APP_DIR"
        exec "$APP_DIR/IsuDeck-Linux-x64" "$@"
        ;;
esac
EOF

chmod +x "$LAUNCHER_WRAPPER"
sudo cp "$LAUNCHER_WRAPPER" "$BIN_LINK"
rm -f "$LAUNCHER_WRAPPER"
echo -e "${GREEN}[OK] Terminal command '$BIN_LINK' registered.${NC}"

# 5. Desktop Application Shortcut (.desktop)
echo -e "\n${CYAN}[5/5] Creating desktop application menu shortcut...${NC}"
mkdir -p "$DESKTOP_DIR"
ICON_PATH="$INSTALL_DIR/isu-deck-ui/public/isudeck_logo.png"
[ ! -f "$ICON_PATH" ] && ICON_PATH="$INSTALL_DIR/isu-deck-ui/src-tauri/icons/128x128.png"

cat << EOF > "$DESKTOP_DIR/isudeck.desktop"
[Desktop Entry]
Name=IsuDeck
Comment=Macro Keypad & Automation Studio
Exec=$BIN_LINK
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=Utility;HardwareSettings;
StartupNotify=true
EOF

chmod +x "$DESKTOP_DIR/isudeck.desktop"
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

echo -e "\n${GREEN}========================================================${NC}"
echo -e "${GREEN}   SUCCESS: IsuDeck has been successfully installed!   ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "[-] Installed Directory : ${BOLD}$INSTALL_DIR${NC}"
echo -e "[-] Terminal Launch     : Type ${BOLD}isudeck${NC} anywhere in your terminal"
echo -e "[-] Desktop Menu        : 'IsuDeck' icon in your applications menu"
echo -e "${YELLOW}[NOTE] If hardware key capture doesn't respond, log out and log back in once to apply 'input' group permissions.${NC}"
echo -e "${GREEN}========================================================${NC}"
