"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Undo2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Player, Gender, AgeClass } from "@/lib/types";
import { PlayerForm } from "./player-form";
import { softDeletePlayer, restorePlayer } from "@/actions/players";
import { getAge } from "@/lib/players";

interface SortableRowProps {
  player: Player;
  gender: Gender;
  index: number;
  isDraggable: boolean;
  onRefresh: () => void;
  showRegistration: boolean;
  isRegistered: boolean;
  onToggleRegistration: (playerUuid: string, registered: boolean) => void;
  isDeleted: boolean;
  isAdmin?: boolean;
  ageClass?: AgeClass;
}

export function SortableRow({
  player,
  gender,
  index,
  isDraggable,
  onRefresh,
  showRegistration,
  isRegistered,
  onToggleRegistration,
  isDeleted,
  isAdmin = false,
  ageClass,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.uuid, disabled: !isDraggable || isDeleted });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isDeleted ? 0.5 : 1,
  };

  const playerName = `${player.first_name} ${player.last_name}`;

  async function handleDelete() {
    await softDeletePlayer(player.uuid, gender);
    onRefresh();
  }

  async function handleRestore() {
    await restorePlayer(player.uuid, gender);
    onRefresh();
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8 text-center text-muted-foreground">
        {isDraggable ? (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing select-none"
          >
            ⠿
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </TableCell>
      {showRegistration && (
        <TableCell className="w-10 text-center">
          {!isDeleted && (
            <Checkbox
              checked={isRegistered}
              onCheckedChange={(checked) =>
                onToggleRegistration(player.uuid, !!checked)
              }
            />
          )}
        </TableCell>
      )}
      <TableCell className="font-medium">{index + 1}</TableCell>
      <TableCell>
        <div className={isDeleted ? "line-through" : ""}>
          {player.last_name}, {player.first_name}
        </div>
        {player.notes && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {player.notes}
          </div>
        )}
      </TableCell>
      <TableCell>{player.birth_date}</TableCell>
      <TableCell className="text-center">{getAge(player.birth_date)}</TableCell>
      <TableCell className="text-center">{player.skill_level}</TableCell>
      <TableCell>{player.license || "—"}</TableCell>
      <TableCell className="text-right">
        {isDeleted ? (
          <div className="flex justify-end gap-1">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={handleRestore}>
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
            {!isAdmin && (
              <div className="invisible">
                <Button variant="ghost" size="sm">✎</Button>
                <Button variant="ghost" size="sm">✕</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            <PlayerForm
              gender={gender}
              ageClass={ageClass}
              player={player}
              onDone={onRefresh}
              isAdmin={isAdmin}
              trigger={
                <Button variant="ghost" size="sm">
                  ✎
                </Button>
              }
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  ✕
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Spieler löschen</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{playerName}</strong> wirklich löschen? Bestehende Meldungen werden entfernt. Nur löschen, wenn die Lizenz entzogen werden soll, z.B. bei Vereinsaustritt.
                    <br /><br />
                    Wenn die Person nur nicht gemeldet werden soll, stattdessen einfach abwählen (Häkchen entfernen).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
