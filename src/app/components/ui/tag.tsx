import { cn } from "./utils";

interface TagProps {
  name: string;
  color: string;
  className?: string;
}

export function Tag({ name, color, className }: TagProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-full border-2",
        className,
      )}
      style={{ borderColor: color }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm">{name}</span>
    </div>
  );
}
