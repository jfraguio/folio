#!/bin/bash
#
# workshop-backup.sh
#
# Backup diario de los archivos de iCloud Drive/WORKSHOP en iCloud Drive/BACKUP.
#
# - Un backup por archivo y día: <nombre>_<AAAA-MM-DD>.<ext> (p. ej. to-do_2026-10-23.txt).
#   Durante el día se sobrescribe el backup de hoy; al cambiar de día se crea uno nuevo.
# - Solo copia si el original es más reciente que su último backup.
# - Conserva como máximo MAX_BACKUPS backups por archivo (borra los más antiguos).
# - Solo procesa archivos del primer nivel de WORKSHOP (ignora subcarpetas y ocultos).
#
# Lo ejecuta cada hora (y al iniciar sesión) un LaunchAgent instalado con
# scripts/workshop-backup-install.sh. Log: ~/Library/Logs/workshop-backup.log
#
# Variables de entorno opcionales (útiles para pruebas):
#   WORKSHOP_BACKUP_SRC, WORKSHOP_BACKUP_DEST, WORKSHOP_BACKUP_MAX,
#   WORKSHOP_BACKUP_DATE (AAAA-MM-DD), WORKSHOP_BACKUP_LOG
#
# Compatible con el bash 3.2 de macOS.

set -o pipefail
shopt -s nullglob

ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
SRC_DIR="${WORKSHOP_BACKUP_SRC:-$ICLOUD_DIR/WORKSHOP}"
DEST_DIR="${WORKSHOP_BACKUP_DEST:-$ICLOUD_DIR/BACKUP}"
MAX_BACKUPS="${WORKSHOP_BACKUP_MAX:-50}"
TODAY="${WORKSHOP_BACKUP_DATE:-$(date +%F)}"
LOG_FILE="${WORKSHOP_BACKUP_LOG:-$HOME/Library/Logs/workshop-backup.log}"
LOCK_FILE="/tmp/workshop-backup.lock"
DOWNLOAD_TIMEOUT=120 # segundos de espera si iCloud tiene el archivo solo en la nube
LOG_MAX_BYTES=1048576
DATE_GLOB='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'

log() {
	local line
	line="$(date '+%F %T') [$1] $2"
	printf '%s\n' "$line" >>"$LOG_FILE"
	[ -t 1 ] && printf '%s\n' "$line"
	return 0
}

trim_log() {
	local size
	size=$(stat -f '%z' "$LOG_FILE" 2>/dev/null || echo 0)
	if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
		tail -n 2000 "$LOG_FILE" >"$LOG_FILE.tmp" && mv -f "$LOG_FILE.tmp" "$LOG_FILE"
	fi
}

# true si iCloud ha "descargado" el archivo del Mac y solo existe en la nube.
is_dataless() {
	case "$(stat -f '%Sf' "$1" 2>/dev/null)" in
	*dataless*) return 0 ;;
	esac
	return 1
}

# Asegura que el archivo está descargado localmente antes de copiarlo.
ensure_local() {
	local file="$1" waited=0
	is_dataless "$file" || return 0
	log INFO "Descargando de iCloud: $(basename "$file")"
	brctl download "$file" >/dev/null 2>&1
	while is_dataless "$file"; do
		if [ "$waited" -ge "$DOWNLOAD_TIMEOUT" ]; then
			return 1
		fi
		sleep 2
		waited=$((waited + 2))
	done
	return 0
}

# true si $1 se modificó después que $2, con precisión de nanosegundos
# (el -nt de bash solo compara segundos enteros).
is_newer() {
	local a b
	a=$(stat -f '%Fm' "$1" 2>/dev/null) || return 0
	b=$(stat -f '%Fm' "$2" 2>/dev/null) || return 0
	[ "${a%.*}" -gt "${b%.*}" ] && return 0
	[ "${a%.*}" -lt "${b%.*}" ] && return 1
	[[ "${a#*.}" > "${b#*.}" ]] # misma longitud (9 dígitos): comparación de texto válida
}

# Rellena el array global BACKUPS con los backups de <base><ext>, del más antiguo al más reciente.
list_backups() {
	BACKUPS=("$DEST_DIR/${1}_"$DATE_GLOB"$2")
}

# --- Comprobaciones iniciales -------------------------------------------------

mkdir -p "$(dirname "$LOG_FILE")"
trim_log

if ! [[ "$TODAY" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
	log ERROR "Fecha no válida: '$TODAY'"
	exit 1
fi

if ! [[ "$MAX_BACKUPS" =~ ^[1-9][0-9]*$ ]]; then
	log ERROR "MAX_BACKUPS no válido: '$MAX_BACKUPS'"
	exit 1
fi

if ! shlock -f "$LOCK_FILE" -p $$; then
	log WARN "Ya hay otra ejecución en curso; se omite esta."
	exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT

if [ ! -d "$SRC_DIR" ]; then
	log ERROR "No existe la carpeta origen: $SRC_DIR"
	exit 1
fi

if ! ls "$SRC_DIR" >/dev/null 2>&1; then
	log ERROR "Sin permiso para leer $SRC_DIR (¿falta 'Acceso total al disco' para /bin/bash?)"
	exit 1
fi

if ! mkdir -p "$DEST_DIR"; then
	log ERROR "No se puede crear la carpeta destino: $DEST_DIR"
	exit 1
fi

# --- Backup -------------------------------------------------------------------

copied=0
unchanged=0
deleted=0
errors=0

for src in "$SRC_DIR"/*; do
	# Solo archivos normales del primer nivel (el glob ya excluye los ocultos).
	[ -f "$src" ] || continue

	name=$(basename "$src")
	if [[ "$name" == *.* ]]; then
		base="${name%.*}"
		ext=".${name##*.}"
	else
		base="$name"
		ext=""
	fi

	target="$DEST_DIR/${base}_${TODAY}${ext}"

	list_backups "$base" "$ext"
	latest=""
	if [ "${#BACKUPS[@]}" -gt 0 ]; then
		latest="${BACKUPS[${#BACKUPS[@]} - 1]}"
	fi

	if [ -n "$latest" ] && ! is_newer "$src" "$latest"; then
		unchanged=$((unchanged + 1))
	elif ! ensure_local "$src"; then
		log ERROR "No se pudo descargar de iCloud: $name"
		errors=$((errors + 1))
	else
		# Copia a un temporal oculto y renombra: el backup nunca queda a medias.
		# cp -p conserva la fecha de modificación del original, que es la que se compara.
		tmp="$DEST_DIR/.${base}_${TODAY}${ext}.tmp-$$"
		if cp -p "$src" "$tmp" && mv -f "$tmp" "$target"; then
			log INFO "Backup: $name -> $(basename "$target")"
			copied=$((copied + 1))
		else
			rm -f "$tmp"
			log ERROR "Fallo al copiar: $name"
			errors=$((errors + 1))
		fi
	fi

	# Rotación: conservar solo los MAX_BACKUPS más recientes de este archivo.
	list_backups "$base" "$ext"
	excess=$((${#BACKUPS[@]} - MAX_BACKUPS))
	i=0
	while [ "$i" -lt "$excess" ]; do
		if rm -f "${BACKUPS[$i]}"; then
			log INFO "Eliminado (límite de $MAX_BACKUPS): $(basename "${BACKUPS[$i]}")"
			deleted=$((deleted + 1))
		else
			log ERROR "No se pudo eliminar: $(basename "${BACKUPS[$i]}")"
			errors=$((errors + 1))
		fi
		i=$((i + 1))
	done
done

log INFO "Fin: $copied copiados, $unchanged sin cambios, $deleted eliminados, $errors errores."

[ "$errors" -eq 0 ]
