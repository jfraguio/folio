/*
 * workshop-backup-runner.c
 *
 * Lanzador mínimo de workshop-backup.sh para el LaunchAgent.
 *
 * macOS (TCC) no permite que procesos lanzados por launchd lean iCloud Drive sin
 * "Acceso total al disco". En lugar de concedérselo a /bin/bash (lo que afectaría
 * a cualquier script bash), se le concede solo a este ejecutable. Lanza bash como
 * proceso hijo para que macOS siga atribuyendo el acceso a este ejecutable.
 *
 * La ruta del script se fija al compilar (-DSCRIPT_PATH="\"...\"") para que el
 * lanzador no ejecute otra cosa. Lo compila scripts/workshop-backup-install.sh.
 */

#include <errno.h>
#include <spawn.h>
#include <stdio.h>
#include <sys/wait.h>

#ifndef SCRIPT_PATH
#error "Compila con -DSCRIPT_PATH=\"\\\"/ruta/a/workshop-backup.sh\\\"\""
#endif

extern char **environ;

int main(void) {
	char *const args[] = {(char *)"/bin/bash", (char *)SCRIPT_PATH, NULL};
	pid_t pid;
	int status;
	int rc = posix_spawn(&pid, "/bin/bash", NULL, NULL, args, environ);

	if (rc != 0) {
		fprintf(stderr, "workshop-backup-runner: no se pudo lanzar bash (error %d)\n", rc);
		return 127;
	}
	while (waitpid(pid, &status, 0) < 0) {
		if (errno != EINTR) {
			perror("workshop-backup-runner: waitpid");
			return 127;
		}
	}
	if (WIFEXITED(status)) {
		return WEXITSTATUS(status);
	}
	return 128 + WTERMSIG(status);
}
