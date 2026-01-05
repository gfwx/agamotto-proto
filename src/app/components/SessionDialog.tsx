import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Star } from "lucide-react";
import type { Tag } from "../../lib/db/appTagUtil";
import { TagSelector } from "./ui/tag-selector";

interface SessionDialogProps {
  open: boolean;
  duration: number;
  initialTag?: Tag | null;
  onSave: (data: {
    title: string;
    rating: number;
    comment: string;
    tag: Tag | null;
  }) => void;
  onCancel: () => void;
  onDiscard: () => void;
}

export function SessionDialog({
  open,
  duration,
  initialTag,
  onSave,
  onCancel,
  onDiscard,
}: SessionDialogProps) {
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Initialize tag from props when dialog opens
  useEffect(() => {
    if (open && initialTag) {
      setSelectedTag(initialTag);
    }
  }, [open, initialTag]);

  const formatDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const handleSave = () => {
    onSave({ title, rating, comment, tag: selectedTag });
    // Reset form
    setTitle("");
    setRating(0);
    setComment("");
    setSelectedTag(null);
    setShowDiscardConfirm(false);
  };

  const handleSkip = () => {
    onCancel();
    // Reset form
    setTitle("");
    setRating(0);
    setComment("");
    setSelectedTag(null);
    setShowDiscardConfirm(false);
  };

  const handleDiscard = () => {
    if (!showDiscardConfirm) {
      setShowDiscardConfirm(true);
    } else {
      onDiscard();
      // Reset form
      setTitle("");
      setRating(0);
      setComment("");
      setSelectedTag(null);
      setShowDiscardConfirm(false);
    }
  };

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="max-w-md [&>button:first-of-type]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session Complete</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="text-center py-2">
            <div className="text-3xl font-mono">{formatDuration(duration)}</div>
            <div className="text-sm text-muted-foreground mt-1">Total time</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Session Title</Label>
            <Input
              id="title"
              placeholder="What did you work on?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Productivity Rating</Label>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="transition-all hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      value <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tag (optional)</Label>
            <TagSelector value={selectedTag} onChange={setSelectedTag} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Notes (optional)</Label>
            <Textarea
              id="comment"
              placeholder="Any reflections or notes..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDiscard}
            className="sm:mr-auto"
          >
            {showDiscardConfirm ? "Confirm Discard" : "Discard"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim()}
            className="sm:mr-auto"
          >
            Save Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
