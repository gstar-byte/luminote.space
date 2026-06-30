import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';

interface SidebarItemProps {
  key?: string | number;
  id?: string;
  icon?: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  isSidebarOpen: boolean;
  isCustom?: boolean;
  count?: number;
}

export function SidebarItem({
  id,
  icon,
  label,
  isActive,
  onClick,
  onRename,
  onDelete,
  isSidebarOpen,
  isCustom = false,
  count
}: SidebarItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    if (editValue.trim() && editValue !== label) {
      onRename?.(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  if (isConfirmingDelete) {
    return (
      <div className="px-3 py-2 mb-1 bg-red-50 rounded-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-right-2 z-50 border border-red-100">
        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider leading-tight">Delete category and its notes?</span>
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
            className="p-1 px-2.5 bg-white text-[#8E8E93] text-[10px] rounded-lg font-bold border border-[#E5E5EA] hover:bg-[#F2F2F7]"
          >
            Cancel
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setIsConfirmingDelete(false); }}
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
        onClick={() => !isEditing && onClick()}
        className={`w-full flex items-center gap-2 rounded-2xl transition-all cursor-pointer select-none group/item ${
          isSidebarOpen ? 'pl-2 pr-3 py-2.5' : 'p-3'
        } ${
          isActive
            ? 'bg-[#007AFF] text-white shadow-lg'
            : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]'
        }`}
      >
        {icon ? (
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {icon}
          </div>
        ) : (
          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-[#C7C7CC]'} ml-0.5`} />
        )}
        {isSidebarOpen && (
          isEditing ? (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className={`bg-black/5 border-none focus:ring-2 focus:ring-[#007AFF]/20 text-sm font-medium w-full rounded px-2 py-0.5 outline-none ${isActive ? 'text-white placeholder-white/60 bg-white/20' : 'text-[#1D1D1F] placeholder-[#8E8E93]'}`}
            />
          ) : (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className={`${isActive ? 'font-bold' : 'font-medium'} text-sm truncate`}>{label}</span>
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 ${isActive ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] text-[#8E8E93]'}`}>
                  {count}
                </span>
              )}
            </div>
          )
        )}
      </div>

      {isCustom && isSidebarOpen && !isEditing && (
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(true);
            }}
            className={`p-1.5 rounded-lg transition-all shadow-sm active:scale-90 ${isActive ? 'bg-white text-[#007AFF] hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-[#8E8E93] hover:text-[#007AFF]'}`}
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsConfirmingDelete(true);
            }}
            className={`p-1.5 rounded-lg transition-all shadow-sm active:scale-90 ${isActive ? 'bg-white text-red-500 hover:bg-white/90' : 'bg-white border border-[#E5E5EA] text-red-500 hover:bg-red-600'}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
