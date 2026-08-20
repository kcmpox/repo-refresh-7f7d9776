import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, Eye, Trash2, Download } from "lucide-react";
import { type Attachment } from "@/lib/storage";
import { getAttachmentUrl } from "@/lib/attachments";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function AttachmentViewerBody({ a, url }: { a: Attachment; url: string | null }) {
  if (!url) {
    return (
      <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Carregando arquivo...
      </div>
    );
  }
  if (a.type.startsWith("image/")) {
    return (
      <img
        src={url}
        alt={a.name}
        className="mx-auto max-h-[60vh] w-auto rounded object-contain"
      />
    );
  }
  if (a.type === "application/pdf") {
    return (
      <iframe
        src={url}
        title={a.name}
        className="h-[65vh] w-full rounded border border-border"
      />
    );
  }
  return (
    <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      Pré-visualização indisponível para este tipo de arquivo.
    </div>
  );
}

export function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    if (!attachment) {
      setUrl(null);
      return;
    }
    setUrl(null);
    getAttachmentUrl(attachment)
      .then((u) => {
        if (!cancel) setUrl(u);
      })
      .catch((err) => {
        console.error(err);
        if (!cancel) toast.error("Erro ao carregar anexo");
      });
    return () => {
      cancel = true;
    };
  }, [attachment]);
  return (
    <Dialog open={!!attachment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{attachment?.name}</DialogTitle>
        </DialogHeader>
        {attachment && (
          <>
            <p className="text-xs text-muted-foreground">
              {(attachment.size / 1024).toFixed(0)} KB · {attachment.type || "arquivo"}
            </p>
            <div className="max-h-[65vh] overflow-y-auto">
              <AttachmentViewerBody a={attachment} url={url} />
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {attachment && url && (
            <Button asChild>
              <a href={url} download={attachment.name} target="_blank" rel="noreferrer">
                <Download className="mr-1 h-4 w-4" /> Baixar
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentsField({
  value,
  onChange,
  label = "Anexos",
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  label?: string;
}) {
  const [viewing, setViewing] = useState<Attachment | null>(null);

  const remove = (id: string) => onChange(value.filter((a) => a.id !== id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Upload de anexos está desabilitado nesta versão."
        >
          <Paperclip className="mr-1 h-3 w-3" />
          Adicionar arquivos
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">indisponível</span>
      </div>
      {value && value.length > 0 && (
        <ul className="space-y-1 text-sm">
          {value.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-border bg-background px-2 py-1"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ({(a.size / 1024).toFixed(0)} KB)
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setViewing(a)}
                  title="Visualizar"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export function AttachmentsList({ items }: { items?: Attachment[] }) {
  const [viewing, setViewing] = useState<Attachment | null>(null);
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => setViewing(a)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs hover:bg-secondary"
          title={`Visualizar ${a.name}`}
        >
          <Paperclip className="h-3 w-3" />
          <span className="max-w-[160px] truncate">{a.name}</span>
        </button>
      ))}
      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}