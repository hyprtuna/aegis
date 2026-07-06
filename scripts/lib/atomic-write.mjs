// atomic-write.mjs — implemented in C2.
//
// C2 contract: write `contents` to `path` atomically via a UUID-suffixed tempfile
// in the SAME directory as the target, fsync the file data to disk, then rename
// the temp over the target. rename(2) is atomic only within a single filesystem,
// so the temp MUST live beside the target — never in /tmp. Readers therefore
// never observe a partial write: they see either the old file or the new one.
//
// On any failure the temp file is removed before the error propagates, so a
// crashed write leaves no orphaned `.tmp-*` debris next to the target.
//
// Durability note: the file *data* is fsync'd before the rename, and the rename
// guarantees readers see either the whole old file or the whole new one (never a
// torn write). The containing *directory* is not fsync'd, so durability of the
// rename across a hard crash is best-effort — adequate for projecting build
// artifacts (hooks, settings), not a database WAL.
//
// Permission bits: when the target already exists, its mode is preserved across
// the replace (openSync's mode applies only to the freshly-created temp and is
// umask-masked). Without this, replacing an executable file — e.g. a hook script
// invoked directly by the host — would silently drop its +x bit and break it.
//
// Node 20+ stdlib only. No deps.

import { randomUUID } from "node:crypto";
import { openSync, writeSync, fsyncSync, closeSync, renameSync, rmSync, statSync, chmodSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";

export function atomicWrite(path, contents) {
  const dir = dirname(path);
  const tmpPath = join(dir, `.${basename(path)}.tmp-${randomUUID()}`);
  const data = typeof contents === "string" ? contents : Buffer.from(contents);

  // Capture the existing target's mode (if any) so we can preserve it across the
  // atomic replace. Done before we open the temp so a missing target is fine.
  let preserveMode;
  if (existsSync(path)) {
    try { preserveMode = statSync(path).mode; } catch { /* race; skip preservation */ }
  }

  let fd;
  try {
    // wx: fail if the temp name somehow already exists (UUID makes this ~impossible).
    fd = openSync(tmpPath, "wx", 0o644);
    writeSync(fd, data);
    fsyncSync(fd); // flush data to disk before the rename publishes it.
    closeSync(fd);
    fd = undefined;
    if (preserveMode !== undefined) chmodSync(tmpPath, preserveMode); // keep +x etc.
    renameSync(tmpPath, path); // atomic publish within the filesystem.
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* already closed / closing failed — nothing more to do */
      }
    }
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      /* best-effort cleanup; surface the original error */
    }
    throw err;
  }
}
