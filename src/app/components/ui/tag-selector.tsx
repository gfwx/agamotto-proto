import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";
import { Tag } from "./tag";
import {
  getAllTags,
  getNextAvailableColor,
  saveTag,
  type Tag as TagType,
} from "../../../lib/db/appTagUtil";
import { cn } from "./utils";
import { toast } from "sonner";

interface TagSelectorProps {
  value: TagType | null;
  onChange: (tag: TagType | null) => void;
  disabled?: boolean;
}

export function TagSelector({ value, onChange, disabled }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<TagType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    try {
      const allTags = await getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error("Failed to load tags:", error);
      toast.error("Failed to load tags");
    }
  };

  const handleSelectTag = (tag: TagType) => {
    if (value && value.name === tag.name) {
      // Deselect if clicking the already selected tag
      onChange(null);
    } else {
      // Select the tag
      onChange(tag);
    }
    setOpen(false);
    setSearchQuery("");
  };

  const handleCreateTag = async () => {
    const name = searchQuery.trim().toLowerCase();

    if (!name) {
      toast.error("Tag name cannot be empty");
      return;
    }

    // Check if tag already exists
    const existingTag = tags.find((t) => t.name.toLowerCase() === name);
    if (existingTag) {
      // Select the existing tag
      onChange(existingTag);
      setOpen(false);
      setSearchQuery("");
      return;
    }

    // Get next available color
    const color = await getNextAvailableColor();
    if (!color) {
      toast.error("Maximum number of tags reached (24)");
      return;
    }

    // Create new tag
    try {
      const newTag: TagType = {
        name,
        color,
        dateCreated: Date.now(),
        dateLastUsed: Date.now(),
        totalInstances: 0,
      };

      await saveTag(newTag);
      onChange(newTag);
      setOpen(false);
      setSearchQuery("");
      toast.success(`Tag "${name}" created`);
    } catch (error) {
      console.error("Failed to create tag:", error);
      toast.error("Failed to create tag");
    }
  };

  const handleClearTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Filter tags based on search query
  const filteredTags =
    searchQuery.trim() === ""
      ? tags
      : tags.filter((tag) =>
          tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );

  const showCreateOption =
    searchQuery.trim() !== "" &&
    !filteredTags.some(
      (tag) => tag.name.toLowerCase() === searchQuery.trim().toLowerCase(),
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          className={cn(
            "relative cursor-pointer",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {value ? (
            <div className="relative inline-flex">
              <Tag name={value.name} color={value.color} />
              {!disabled && (
                <button
                  onClick={handleClearTag}
                  className="absolute -right-1 -top-1 rounded-full bg-background border p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center">
              <div className="text-sm text-muted-foreground border-b-2 border-foreground pb-0.5 min-w-[100px]">
                Tags
              </div>
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create tag..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {filteredTags.length === 0 && !showCreateOption && (
              <CommandEmpty>No tags found.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredTags.map((tag) => (
                <CommandItem
                  key={tag.name}
                  onSelect={() => handleSelectTag(tag)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                    {value && value.name === tag.name && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Selected
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {showCreateOption && (
                <CommandItem
                  onSelect={handleCreateTag}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new tag: <strong className="ml-1">{searchQuery}</strong>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
