import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Star } from 'lucide-react';

interface SessionDialogProps {
  open: boolean;
  duration: number;
  onSave: (data: {
    title: string;
    rating: number;
    comment: string;
  }) => void;
  onCancel: () => void;
}

export function SessionDialog({ open, duration, onSave, onCancel }: SessionDialogProps) {
  const [title, setTitle] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

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
    onSave({ title, rating, comment });
    // Reset form
    setTitle('');
    setRating(0);
    setComment('');
  };

  const handleSkip = () => {
    onCancel();
    // Reset form
    setTitle('');
    setRating(0);
    setComment('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
      <DialogContent className="max-w-md">
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
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
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

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            Save Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
