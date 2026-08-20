// Módulo de anexos neutralizado: uploads desabilitados; mantém apenas utilitários
// legados para compatibilidade com dados já salvos localmente (formato dataUrl).
import { type Attachment } from "@/lib/storage";

export const ATTACHMENTS_BUCKET = "comprovantes";

/** Uploads estão desabilitados nesta versão. */
export async function uploadAttachmentFile(_file: File): Promise<Attachment> {
  throw new Error("Upload de anexos está desabilitado.");
}

/** Uploads estão desabilitados nesta versão. */
export async function uploadAttachmentBlob(
  _blob: Blob,
  _name: string,
  _type: string,
): Promise<Attachment> {
  throw new Error("Upload de anexos está desabilitado.");
}

/** Retorna uma URL utilizável pelo navegador apenas para anexos legados (dataUrl). */
export async function getAttachmentUrl(a: Attachment): Promise<string> {
  if (a.dataUrl) return a.dataUrl;
  throw new Error("Visualização indisponível para este anexo.");
}

/** Converte um dataUrl em Blob (compatibilidade). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** No-op: migração desativada (mantém o anexo como está). */
export async function migrateLegacyAttachment(a: Attachment): Promise<Attachment> {
  return a;
}
