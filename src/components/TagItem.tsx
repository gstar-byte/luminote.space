import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';

interface TagItemProps {
  tag: string;
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  setCategoryFilter: (cat: string) => void;
  removeTag: (tag: string) => void;
  onRename?: (oldTag: string, newTag: string) => void;
  isMobile: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  count?: number;
}

export function TagItem({ tag, tagFilter, setTagFilter, setCategoryFilter, removeTag, onRename, isMobile, setIsSidebarOpen, count }: TagItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tag);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    if (editValue.trim() && editValue !== tag) {
      onRename?.(tag, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditValue(tag);
      setIsEditing(false);
    }
  };

  if (isConfirmingDelete) {
    return (
      <div className="px-3 py-2 mb-1 bg-red-50 rounded-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-right-2 z-50 border border-red-100">
        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider leading-tight">Delete tag and its notes?</span>
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
            className="p-1 px-2.5 bg-white text-[#8E8E93] text-[10px] rounded-lg font-bold border border-[#E5E5EA] hover:bg-[#F2F2F7]"
          >
            Cancel
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeTag(tag); setIsConfirmingDelete(false); }}
            className="p-1 px-3 bg-red-500 text-white text-[10px] rounded-lg font-bold hover:bg-red-600 shadow-sm"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative group w-full mb-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onClick={() => {
          if (isEditing) return;
          setTagFilter(tag === tagFilter ? null : tag);
          setCategoryFilter('all');
          if (isMobile) setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl text-sm transition-all cursor-pointer select-none ${
          tagFilter === tag
            ? 'bg-[#007AFF] text-white shadow-lg'
            : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]'
        }`}
      >
        <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${tagFilter === tag ? 'bg-white' : 'bg-current opacity-40'}`} />
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`bg-black/5 border-none focus:ring-2 focus:ring-[#007AFF]/20 text-sm font-medium w-full rounded px-2 py-0.5 outline-none ${tagFilter === tag ? 'text-white placeholder-white/60 bg-white/20' : 'text-[#1D1D1F] placeholder-[#8E8E93]'}`}
          />
        ) : (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className={`${tagFilter === tag ? 'font-bold' : 'font-medium'} truncate`}>{tag}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 ${tagFilter === tag ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] text-[#8E8E93]'}`}>
                {count}
              </span>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }}
            className={`p-1.5 rounded-lg shadow-sm active:scale-90 transition-all ${tagFilter === tag ? 'bg-white text-[#007AFF] hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-[#8E8E93] hover:text-[#007AFF]'}`}
            title="Rename"
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsConfirmingDelete(true); }}
            className={`p-1.5 rounded-lg shadow-sm active:scale-90 transition-all ${tagFilter === tag ? 'bg-white text-red-500 hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-red-500 hover:bg-red-600'}`}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
