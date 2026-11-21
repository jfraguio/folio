#!/bin/bash
#
# workshop-backup-install.sh
#
# Instala (o desinstala) el LaunchAgent que ejecuta workshop-backup.sh
# cada hora y al iniciar sesión, también después de reiniciar el Mac.
#
# Uso:
#   scripts/workshop-backup-install.sh              # instalar / actualizar
#   scripts/workshop-backup-install.sh --uninstall  # desinstalar
#
# Qué instala (fuera de ~/Documents, porque macOS impide a launchd usarlo):
#   ~/Library/Scripts/workshop-backup.sh         copia del script de este repo
#   ~/Library/Scripts/workshop-backup-runner     lanzador compilado de workshop-backup-runner.c
#   ~/Library/LaunchAgents/<label>.plist         LaunchAgent (cada hora + al iniciar sesión)
#
# Este repo es la fuente: tras modificar el script, vuelve a ejecutar el instalador.
#
# Una sola vez: dar "Acceso total al disco" a workshop-backup-runner para que pueda
# leer iCloud Drive. El lanzador solo se recompila si cambia su código fuente, ya que
# recompilarlo obliga a conceder el permiso de nuevo.

set -euo pipefail

LABEL="com.$(id -un).workshop-backup"
SRC_DIR_REPO="$(cd "$(dirname "$0")" && pwd)"
SOURCE_SCRIPT="$SRC_DIR_REPO/workshop-backup.sh"
SOURCE_RUNNER="$SRC_DIR_REPO/workshop-backup-runner.c"
INSTALL_DIR="$HOME/Library/Scripts"
SCRIPT="$INSTALL_DIR/workshop-backup.sh"
RUNNER="$INSTALL_DIR/workshop-backup-runner"
RUNNER_STAMP="$INSTALL_DIR/.workshop-backup-runner.sha256"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_FILE="$HOME/Library/Logs/workshop-backup.log"
DOMAIN="gui/$(id -u)"
INTERVAL=3600 # segundos

xml_escape() {
	printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

unload() {
	launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
}

if [ "${1:-}" = "--uninstall" ]; then
	unload
	rm -f "$PLIST" "$SCRIPT" "$RUNNER" "$RUNNER_STAMP"
	echo "LaunchAgent $LABEL desinstalado. Los backups existentes no se han tocado."
	echo "Puedes quitar workshop-backup-runner de Ajustes > Privacidad y seguridad > Acceso total al disco."
	exit 0
fi

for f in "$SOURCE_SCRIPT" "$SOURCE_RUNNER"; do
	if [ ! -f "$f" ]; then
		echo "No se encuentra $f" >&2
		exit 1
	fi
done

mkdir -p "$INSTALL_DIR" "$(dirname "$PLIST")" "$(dirname "$LOG_FILE")"

# 1) Script
cp "$SOURCE_SCRIPT" "$SCRIPT"
chmod 755 "$SCRIPT"

# 2) Lanzador: solo se recompila si cambia el código fuente o la ruta del script.
stamp="$( (cat "$SOURCE_RUNNER"; printf '%s' "$SCRIPT") | shasum -a 256 | cut -d' ' -f1)"
rebuilt=0
if [ ! -x "$RUNNER" ] || [ "$(cat "$RUNNER_STAMP" 2>/dev/null)" != "$stamp" ]; then
	clang -O2 -Wall -Wextra -Werror -DSCRIPT_PATH="\"$SCRIPT\"" -o "$RUNNER.tmp" "$SOURCE_RUNNER"
	codesign --force --sign - --identifier "$LABEL" "$RUNNER.tmp"
	mv -f "$RUNNER.tmp" "$RUNNER"
	printf '%s\n' "$stamp" >"$RUNNER_STAMP"
	rebuilt=1
fi

# 3) LaunchAgent
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>$(xml_escape "$RUNNER")</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>StartInterval</key>
	<integer>$INTERVAL</integer>
	<key>ProcessType</key>
	<string>Background</string>
	<key>LowPriorityIO</key>
	<true/>
	<key>StandardOutPath</key>
	<string>$(xml_escape "$LOG_FILE")</string>
	<key>StandardErrorPath</key>
	<string>$(xml_escape "$LOG_FILE")</string>
</dict>
</plist>
EOF
plutil -lint "$PLIST" >/dev/null

unload
launchctl bootstrap "$DOMAIN" "$PLIST"

echo "LaunchAgent $LABEL instalado (se ejecuta ahora, cada hora y al iniciar sesión)."
echo "  Script:    $SCRIPT"
echo "  Lanzador:  $RUNNER$([ "$rebuilt" -eq 1 ] && echo ' (recompilado)')"
echo "  Plist:     $PLIST"
echo "  Log:       $LOG_FILE"

# 4) Comprobar que tiene acceso a iCloud Drive.
sleep 3
if tail -n 5 "$LOG_FILE" 2>/dev/null | grep -q 'Sin permiso'; then
	cat <<EOF

FALTA UN PASO (una sola vez): dar acceso a iCloud Drive al lanzador.
  1. Se abrirán Ajustes > Privacidad y seguridad > Acceso total al disco
     y una ventana de Finder con workshop-backup-runner seleccionado.
  2. Arrastra workshop-backup-runner a la lista (o pulsa + y elígelo) y actívalo.
     Si ya aparecía de una instalación anterior, quítalo (-) y añádelo de nuevo.
  3. Comprueba con:  launchctl kickstart -k $DOMAIN/$LABEL && sleep 3 && tail -n 5 "$LOG_FILE"
EOF
	open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles" || true
	open -R "$RUNNER" || true
fi
