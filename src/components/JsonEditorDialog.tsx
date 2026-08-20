import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";

interface JsonEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  data: unknown;
  onSave: (data: unknown) => void;
}

export function JsonEditorDialog({
  open,
  onOpenChange,
  title,
  data,
  onSave,
}: JsonEditorDialogProps) {
  const initialText = JSON.stringify(data, null, 2);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(data, null, 2));
    setError(null);
  }, [data, open]);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      onSave(parsed);
      onOpenChange(false);
      toast.success("Dados salvos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON inválido");
    }
  }, [text, onSave, onOpenChange]);

  const handleReset = useCallback(() => {
    setText(JSON.stringify(data, null, 2));
    setError(null);
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="outline" className="text-xs">
              Editor JSON
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            className="h-[55vh] resize-none font-mono text-xs"
            spellCheck={false}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-1 h-4 w-4" /> Restaurar
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-1 h-4 w-4" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
