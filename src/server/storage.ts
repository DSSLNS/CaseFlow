import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "storage", "attachments");

function fileFor(id: string) {
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error("Invalid attachment id");
  return path.join(ROOT, id);
}

export async function saveAttachmentFile(id: string, bytes: Buffer) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(fileFor(id), bytes);
}

export async function readAttachmentFile(id: string) {
  return readFile(fileFor(id));
}

export async function removeAttachmentFile(id: string) {
  await rm(fileFor(id), { force: true });
}
