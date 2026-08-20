import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type Req = { url: string; filename: string } | null;

let listener: ((r: Req) => void) | null = null;

export function requestPdfPreview(url: string, filename: string) {
  if (!listener) {
    // Fallback: se o host ainda não montou, dispara download direto.
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    return;
  }
  listener({ url, filename });
}

export function PdfPreviewHost() {
  const [req, setReq] = useState<Req>(null);

  useEffect(() => {
    listener = setReq;
    return () => {
      listener = null;
    };
  }, []);

  const close = () => {
    if (req?.url) URL.revokeObjectURL(req.url);
    setReq(null);
  };

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {req?.filename ?? "Pré-visualização"}
          </DialogTitle>
        </DialogHeader>
        {req && (
          <iframe
            src={req.url}
            title={req.filename}
            className="h-[70vh] w-full rounded border border-border bg-white"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Fechar
          </Button>
          {req && (
            <Button asChild>
              <a href={req.url} download={req.filename}>
                <Download className="mr-1 h-4 w-4" /> Baixar
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}