#!/usr/bin/env bash
# ==============================================================================
# IsuDeck Linux Automated Updater
# Usage:
#   isudeck update
#   or: ./update.sh
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}             IsuDeck Linux Automated Updater            ${NC}"
echo -e "${CYAN}========================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$SCRIPT_DIR"
BIN_LINK="/usr/local/bin/isudeck"

# If run from outside, fallback to $HOME/IsuDeck
if [ ! -d "$INSTALL_DIR/.git" ] && [ -d "$HOME/IsuDeck/.git" ]; then
    INSTALL_DIR="$HOME/IsuDeck"
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo -e "${RED}[ERROR] IsuDeck git repository not found at '$INSTALL_DIR'.${NC}"
    echo -e "${YELLOW}Please run the web installer to repair or update:${NC}"
    echo "  curl -fsSL https://raw.githubusercontent.com/muzmahil/IsuDeck/main/install.sh | bash"
    exit 1
fi

cd "$INSTALL_DIR"
echo -e "\n${CYAN}--> Fetching latest updates from GitHub (main)...${NC}"
git fetch origin main
git reset --hard origin/main

echo -e "\n${CYAN}--> Rebuilding IsuDeck with latest changes...${NC}"
chmod +x "$INSTALL_DIR/build-linux.sh"
"$INSTALL_DIR/build-linux.sh"

# Update global launcher command in /usr/local/bin/isudeck
if [ -f "$INSTALL_DIR/install.sh" ]; then
    echo -e "\n${CYAN}--> Refreshing terminal command '$BIN_LINK'...${NC}"
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
fi

echo -e "\n${GREEN}========================================================${NC}"
echo -e "${GREEN}   SUCCESS: IsuDeck has been updated successfully!     ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "[-] To launch now: ${BOLD}isudeck${NC}"
echo -e "${GREEN}========================================================${NC}"
