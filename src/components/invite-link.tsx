"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw, Trash2, Check, Loader2 } from "lucide-react";
import { generateInviteToken, revokeInviteToken } from "@/actions/members";
import { toast } from "sonner";

interface InviteLinkProps {
  teamId: string;
  inviteToken: string | null;
}

export function InviteLink({ teamId, inviteToken: initial }: InviteLinkProps) {
  const [token, setToken] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const inviteUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${token}`
    : null;

  function handleGenerate() {
    startTransition(async () => {
      try {
        const newToken = await generateInviteToken(teamId);
        setToken(newToken);
        toast.success("Einladungslink erstellt");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function handleRevoke() {
    if (!confirm("Einladungslink wirklich deaktivieren?")) return;
    startTransition(async () => {
      try {
        await revokeInviteToken(teamId);
        setToken(null);
        toast.success("Einladungslink deaktiviert");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      {inviteUrl ? (
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={inviteUrl}
            className="text-xs font-mono"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleGenerate} disabled={isPending} className="shrink-0">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleRevoke} disabled={isPending} className="shrink-0 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Einladungslink erstellen
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Teile diesen Link mit Spielern, damit sie sich selbst registrieren können.
      </p>
    </div>
  );
}
