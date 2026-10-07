#!/usr/bin/env bash
# ==============================================================================
# IsuDeck Linux Uninstaller Script
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/muzmahil/IsuDeck/main/uninstall.sh | bash
#   or: ./uninstall.sh
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}             IsuDeck Linux Uninstaller                  ${NC}"
echo -e "${CYAN}========================================================${NC}"

INSTALL_DIR="$HOME/IsuDeck"
BIN_LINK="/usr/local/bin/isudeck"
DESKTOP_FILE="$HOME/.local/share/applications/isudeck.desktop"
AUTOSTART_FILE="$HOME/.config/autostart/isudeck.desktop"
AUTOSTART_FILE_ALT="$HOME/.config/autostart/IsuDeck.desktop"
UDEV_RULE_FILE="/etc/udev/rules.d/99-isudeck-input.rules"

# 1. Remove Terminal Command Link
if [ -f "$BIN_LINK" ] || [ -L "$BIN_LINK" ]; then
    echo "--> Removing terminal launcher ($BIN_LINK)..."
    sudo rm -f "$BIN_LINK"
fi

# 2. Remove Desktop Shortcut
if [ -f "$DESKTOP_FILE" ]; then
    echo "--> Removing desktop application menu shortcut..."
    rm -f "$DESKTOP_FILE"
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# 3. Remove Autostart Entries
if [ -f "$AUTOSTART_FILE" ] || [ -f "$AUTOSTART_FILE_ALT" ]; then
    echo "--> Removing autostart entries..."
    rm -f "$AUTOSTART_FILE" "$AUTOSTART_FILE_ALT"
fi

# 4. Remove Udev Rules (Optional / Promptless cleanup)
if [ -f "$UDEV_RULE_FILE" ]; then
    echo "--> Removing udev input rules ($UDEV_RULE_FILE)..."
    sudo rm -f "$UDEV_RULE_FILE"
    sudo udevadm control --reload-rules 2>/dev/null || true
fi

# 5. Remove Application Directory
if [ -d "$INSTALL_DIR" ]; then
    echo "--> Removing IsuDeck folder ($INSTALL_DIR)..."
    rm -rf "$INSTALL_DIR"
fi

echo -e "\n${GREEN}========================================================${NC}"
echo -e "${GREEN}   SUCCESS: IsuDeck has been completely removed!       ${NC}"
echo -e "${GREEN}========================================================${NC}"
