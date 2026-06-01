import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import './CapsuleEditor.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CapsuleEditorProps {
  /** Initial content — either a Tiptap JSON string or legacy plain text. */
  content: string;
  onChange: (json: string, text: string) => void;
  placeholder?: string;
  /** When true the editor is read-only (card preview mode). */
  readOnly?: boolean;
  /** Autofocus the editor on mount. */
  autoFocus?: boolean;
  editMode?: 'plain' | 'rich' | 'markdown';
  onModeChange?: (mode: 'plain' | 'rich' | 'markdown') => void;
}

// Helper: parse content that might be legacy plain-text or Tiptap JSON
function parseContent(raw: string): string | object {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'doc') return parsed;
  } catch { /* not JSON — treat as plain text */ }
  return raw;
}

// Helper to extract plain text from Tiptap JSON node
function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------
function ToolBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`capsule-editor-tool-btn${active ? ' active' : ''}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slash command panel options
// ---------------------------------------------------------------------------
const SLASH_ITEMS = [
  { label: 'Heading 1', icon: <Heading1 size={15} />, cmd: (editor: any) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: <Heading2 size={15} />, cmd: (editor: any) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Normal text', icon: <Type size={15} />, cmd: (editor: any) => editor.chain().focus().setParagraph().run() },
  { label: 'Bullet list', icon: <List size={15} />, cmd: (editor: any) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Ordered list', icon: <ListOrdered size={15} />, cmd: (editor: any) => editor.chain().focus().toggleOrderedList().run() },
  { label: 'Blockquote', icon: <Quote size={15} />, cmd: (editor: any) => editor.chain().focus().toggleBlockquote().run() },
  { label: 'Insert image', icon: <ImageIcon size={15} />, cmd: (_editor: any, openImage: () => void) => openImage() },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CapsuleEditor({
  content,
  onChange,
  placeholder = 'Write your idea...',
  readOnly = false,
  autoFocus = false,
  editMode: externalEditMode,
  onModeChange,
}: CapsuleEditorProps) {
  const [localEditMode, setLocalEditMode] = useState<'plain' | 'rich' | 'markdown'>('plain');
  // 图片查看缩放（点击编辑器内图片放大查看，参考锤子便签）。
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const editMode = externalEditMode ?? localEditMode;
  const setEditMode = onModeChange ?? setLocalEditMode;
  const [markdownText, setMarkdownText] = useState('');
  
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      ImageExtension.configure({ inline: false }),
      BubbleMenuExtension,
    ],
    content: parseContent(content) as any,
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    onUpdate({ editor }) {
      if (editMode === 'rich') {
        onChange(JSON.stringify(editor.getJSON()), editor.getText());
      }
    },
  });

  // Bi-directional content sync for external changes
  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    if (editMode === 'rich') {
      const current = JSON.stringify(editor.getJSON());
      const incoming = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      if (current !== incoming) {
        editor.commands.setContent(parsed as any);
      }
    } else {
      setMarkdownText(extractText(parsed));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editMode]);

  // Mode switcher handler
  const handleModeToggle = (mode: 'plain' | 'rich' | 'markdown') => {
    if (mode === editMode) return;
    if (mode === 'markdown') {
      if (editor) {
        const text = editor.getText();
        setMarkdownText(text);
        onChange(text, text);
      }
    } else {
      if (editor) {
        editor.commands.setContent(markdownText);
        onChange(JSON.stringify(editor.getJSON()), editor.getText());
      }
    }
    setEditMode(mode);
  };

  const handleMarkdownChange = (val: string) => {
    setMarkdownText(val);
    onChange(val, val);
  };

  // Cursor-aware markdown formatting inserter helper
  const insertMarkdown = (syntax: string, selectionPlaceholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selected = text.substring(start, end) || selectionPlaceholder;

    const replacement = syntax.includes('$1') 
      ? syntax.replace('$1', selected) 
      : syntax + selected;

    const nextText = before + replacement + after;
    handleMarkdownChange(nextText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.indexOf(selected);
      textarea.setSelectionRange(newCursorPos, newCursorPos + selected.length);
    }, 0);
  };

  // -------------------------------------------------------------------------
  // Slash command logic
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Slash 菜单仅在富文本模式生效；纯文本/Markdown 直接放行键入。
      if (editMode !== 'rich') return;
      if (e.key === '/') {
        setShowSlash(true);
        setSlashFilter('');
        setSlashIndex(0);
        return;
      }
      if (!showSlash) return;
      if (e.key === 'Escape') { setShowSlash(false); return; }
      if (e.key === 'Backspace') {
        setSlashFilter(p => { if (p.length === 0) { setShowSlash(false); } return p.slice(0, -1); });
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % SLASH_ITEMS.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => (i - 1 + SLASH_ITEMS.length) % SLASH_ITEMS.length); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredSlash[slashIndex];
        if (item) {
          editor?.chain().focus().deleteRange({
            from: editor.state.selection.from - 1 - slashFilter.length,
            to: editor.state.selection.from,
          }).run();
          item.cmd(editor, () => imageInputRef.current?.click());
          setShowSlash(false);
        }
        return;
      }
      if (e.key.length === 1) {
        setSlashFilter(p => p + e.key);
      }
    },
    [showSlash, slashIndex, slashFilter, editor, editMode],
  );

  const filteredSlash = SLASH_ITEMS.filter(i =>
    i.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // -------------------------------------------------------------------------
  // Image insert via file input
  // -------------------------------------------------------------------------
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertImageUrl = () => {
    const url = prompt('Enter image URL:');
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    const prev = editor?.getAttributes('link').href || '';
    const url = prompt('Enter URL:', prev);
    if (url === null) return;
    if (url === '') { editor?.chain().focus().unsetLink().run(); return; }
    editor?.chain().focus().setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className="capsule-editor-root" onKeyDown={handleKeyDown}>
      {/* 2. Editor Core body selection based on editMode */}
      {editMode === 'rich' ? (
        <>
          {/* Bubble Menu — appears when text is selected */}
          {!readOnly && (
            <BubbleMenu
              editor={editor}
              options={{ placement: 'top' }}
              className="capsule-bubble-menu"
            >
              <ToolBtn active={editor.isActive('bold')} title="Bold (⌘B)" onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolBtn>
              <ToolBtn active={editor.isActive('italic')} title="Italic (⌘I)" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolBtn>
              <ToolBtn active={editor.isActive('underline')} title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolBtn>
              <ToolBtn active={editor.isActive('strike')} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></ToolBtn>
              <div className="capsule-bubble-divider" />
              <ToolBtn active={editor.isActive('heading', { level: 1 })} title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={14} /></ToolBtn>
              <ToolBtn active={editor.isActive('heading', { level: 2 })} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolBtn>
              <div className="capsule-bubble-divider" />
              <ToolBtn active={editor.isActive({ textAlign: 'left' })} title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={14} /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'center' })} title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={14} /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'right' })} title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={14} /></ToolBtn>
              <div className="capsule-bubble-divider" />
              <ToolBtn active={editor.isActive('link')} title="Link" onClick={setLink}><LinkIcon size={14} /></ToolBtn>
              <ToolBtn active={false} title="Insert image" onClick={() => imageInputRef.current?.click()}><ImageIcon size={14} /></ToolBtn>
            </BubbleMenu>
          )}

          {/* Rich text TipTap body — 点击图片放大查看（缩放） */}
          <EditorContent
            editor={editor}
            className="capsule-editor-content"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (t && t.tagName === 'IMG') {
                setLightboxZoom(1);
                setLightboxSrc((t as HTMLImageElement).src);
              }
            }}
          />

          {/* Slash command panel */}
          {showSlash && filteredSlash.length > 0 && (
            <div className="capsule-slash-panel">
              <div className="capsule-slash-hint">Type to filter · ↑↓ navigate · Enter select · Esc close</div>
              {filteredSlash.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  className={`capsule-slash-item${i === slashIndex ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor?.chain().focus().deleteRange({
                      from: editor.state.selection.from - 1 - slashFilter.length,
                      to: editor.state.selection.from,
                    }).run();
                    item.cmd(editor, () => imageInputRef.current?.click());
                    setShowSlash(false);
                  }}
                >
                  <span className="capsule-slash-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : editMode === 'plain' ? (
        /* 纯文本模式（默认）：聚焦输入，无格式工具栏，所见即所得的纯文本 */
        <div className="capsule-plain-editor w-full bg-transparent border-none shadow-none overflow-hidden">
          <textarea
            ref={textareaRef}
            value={markdownText}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            placeholder={placeholder}
            disabled={readOnly}
            autoFocus={autoFocus}
            className="w-full min-h-[220px] bg-transparent border-none outline-none resize-none text-[15px] font-medium leading-[2rem] text-[#2c2c2e] placeholder-[#8E8E93]/40 font-sans focus:ring-0 focus:border-none focus:outline-none p-0"
          />
        </div>
      ) : (
        /* Markdown Editor Mode */
        <div className="capsule-markdown-editor w-full bg-transparent border-none shadow-none overflow-hidden">
          {/* Markdown formatting Inserter Bar */}
          {!readOnly && (
            <div className="absolute bottom-[calc(100%+12px)] left-0 flex items-center gap-1.5 p-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/5 rounded-xl shrink-0 z-20 shadow-sm">
              <button
                type="button"
                onClick={() => insertMarkdown('# $1', 'Heading 1')}
                className="px-2 py-1 text-[11px] font-black text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer font-bold text-xs"
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('## $1', 'Heading 2')}
                className="px-2 py-1 text-[11px] font-bold text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer font-bold text-xs"
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('### $1', 'Heading 3')}
                className="px-2 py-1 text-[11px] font-semibold text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer font-bold text-xs"
                title="Heading 3"
              >
                H3
              </button>
              <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
              
              <button
                type="button"
                onClick={() => insertMarkdown('**$1**', 'bold text')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Bold"
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('*$1*', 'italic text')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Italic"
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('++$1++', 'underline text')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Underline"
              >
                <UnderlineIcon size={13} />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('~~$1~~', 'strikethrough text')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Strikethrough"
              >
                <Strikethrough size={13} />
              </button>
              
              <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
              
              <button
                type="button"
                onClick={() => insertMarkdown('> $1', 'blockquote')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Quote"
              >
                <Quote size={13} />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('- $1', 'list item')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Bullet List"
              >
                <List size={13} />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('1. $1', 'list item')}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Ordered List"
              >
                <ListOrdered size={13} />
              </button>
              
              <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
              
              <button
                type="button"
                onClick={() => {
                  const url = prompt('Enter link URL:');
                  if (url) insertMarkdown(`[$1](${url})`, 'link text');
                }}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Insert Link"
              >
                <LinkIcon size={13} />
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const url = prompt('Enter image URL:');
                  if (url) insertMarkdown(`![$1](${url})`, 'image');
                }}
                className="p-1 text-[#555] dark:text-[#F2F2F7] hover:bg-white dark:hover:bg-[#1C1C1E] rounded-lg transition-all cursor-pointer"
                title="Insert Image URL"
              >
                <ImageIcon size={13} />
              </button>
            </div>
          )}

          {/* Raw Textarea input */}
          <textarea
            ref={textareaRef}
            value={markdownText}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            placeholder="Write raw thoughts or Markdown..."
            disabled={readOnly}
            className="w-full min-h-[220px] bg-transparent border-none outline-none resize-none text-[15px] font-medium leading-[2rem] text-[#2c2c2e] placeholder-[#8E8E93]/40 font-sans focus:ring-0 focus:border-none focus:outline-none p-0"
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />

      {/* 图片缩放查看层（Lightbox）：点击图片放大，支持 +/- 缩放 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="absolute top-4 right-4 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              title="Zoom out"
              onClick={() => setLightboxZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-white text-xs font-bold w-12 text-center tabular-nums">{Math.round(lightboxZoom * 100)}%</span>
            <button
              type="button"
              title="Zoom in"
              onClick={() => setLightboxZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              title="Close"
              onClick={() => setLightboxSrc(null)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={lightboxSrc}
            alt=""
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              setLightboxZoom((z) => {
                const next = e.deltaY < 0 ? z + 0.15 : z - 0.15;
                return Math.min(5, Math.max(0.25, +next.toFixed(2)));
              });
            }}
            style={{ transform: `scale(${lightboxZoom})` }}
            className="max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-150 select-none"
          />
        </div>
      )}
    </div>
  );
}
