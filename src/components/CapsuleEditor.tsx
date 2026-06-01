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
import { NodeSelection } from '@tiptap/pm/state';
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
  ChevronDown,
  Trash2,
  Maximize2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import './CapsuleEditor.css';

const CustomImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        renderHTML: attributes => {
          return {
            width: attributes.width,
            style: `width: ${attributes.width}; max-width: 100%; height: auto; display: block; margin: 8px auto; border-radius: 10px; cursor: pointer; transition: all 0.2s;`,
          }
        },
        parseHTML: element => element.getAttribute('width') || '100%',
      },
    }
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CapsuleEditorProps {
  /** Initial content — Tiptap JSON string, HTML string, or legacy plain text. */
  content: string;
  onChange: (json: string, text: string) => void;
  placeholder?: string;
  /** When true the editor is read-only (card preview mode). */
  readOnly?: boolean;
  /** Autofocus the editor on mount. */
  autoFocus?: boolean;
  /**
   * - `plain`    纯文本：展示底层源码（HTML 标记），适合查看/直接编辑标记。
   * - `rich`     富文本：工具栏驱动的所见即所得。
   * - `markdown` Markdown：键入 Markdown 语法即时可视化（同样所见即所得）。
   */
  editMode?: 'plain' | 'rich' | 'markdown';
  onModeChange?: (mode: 'plain' | 'rich' | 'markdown') => void;
}

// Helper: parse content that might be Tiptap JSON, HTML, or legacy plain text.
function parseContent(raw: string): string | object {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'doc') return parsed;
  } catch { /* not JSON — treat as HTML / plain text */ }
  return raw;
}

// Strip HTML tags → plain text (用于 onChange 的纯文本回传)。
function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
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
  const editMode = externalEditMode ?? localEditMode;
  const setEditMode = onModeChange ?? setLocalEditMode;

  // 纯文本模式下展示/编辑的源码（HTML 标记）。
  const [plainSource, setPlainSource] = useState('');
  // 图片查看缩放（点击编辑器内图片放大查看，参考锤子便签）。
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const headingMenuRef = useRef<HTMLDivElement>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevModeRef = useRef<'plain' | 'rich' | 'markdown' | null>(null);

  const isVisual = editMode !== 'plain';

  // Handle clicking outside heading dropdown to close it
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (headingMenuRef.current && !headingMenuRef.current.contains(e.target as Node)) {
        setHeadingMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const lastLoadedContentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      CustomImage.configure({ inline: false }),
      BubbleMenuExtension,
    ],
    content: parseContent(content) as any,
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    onUpdate({ editor }) {
      // 可视化模式（rich / markdown）统一以 Tiptap JSON 持久化。
      if (editMode !== 'plain') {
        const json = JSON.stringify(editor.getJSON());
        lastLoadedContentRef.current = json;
        onChange(json, editor.getText());
      }
    },
  });

  // External content sync (仅当外部真的更换了文档或者从 plain 源码编辑切回时生效)
  useEffect(() => {
    if (!editor || editMode === 'plain') return;
    
    // 拦截 React 属性异步传递导致的旧内容覆盖
    if (content === lastLoadedContentRef.current && prevModeRef.current !== 'plain') {
      return;
    }
    
    const parsed = parseContent(content);
    const current = JSON.stringify(editor.getJSON());
    const incoming = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    if (current !== incoming) {
      editor.commands.setContent(parsed as any);
    }
    lastLoadedContentRef.current = content;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editMode]);

  // 模式切换：可视化 ↔ 纯文本之间做源码与文档的双向转换。
  useEffect(() => {
    if (!editor) return;
    const prev = prevModeRef.current;
    if (prev === editMode) return;
    if (editMode === 'plain') {
      // 进入纯文本：把当前文档序列化为 HTML 源码展示。
      setPlainSource(editor.getHTML());
    } else if (prev === 'plain') {
      // 离开纯文本：把源码解析回可视化文档（Tiptap 原生支持 HTML 解析）。
      editor.commands.setContent(plainSource || '');
      const json = JSON.stringify(editor.getJSON());
      lastLoadedContentRef.current = json;
      onChange(json, editor.getText());
    }
    prevModeRef.current = editMode;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, editor]);

  const handlePlainChange = (val: string) => {
    setPlainSource(val);
    lastLoadedContentRef.current = val;
    // 纯文本下以 HTML 源码持久化；纯文本回传用于卡片预览。
    onChange(val, stripHtml(val));
  };

  // -------------------------------------------------------------------------
  // Slash command logic（可视化模式）
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Slash 菜单仅在可视化模式生效；纯文本直接放行键入。
      if (editMode === 'plain') return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {isVisual ? (
        <>
          {/* 常驻可视化工具栏：移到外面，使用干净的扁平化底色 */}
          {!readOnly && (
            <div className="capsule-editor-toolbar mb-3">
              <ToolBtn active={editor.isActive('bold')} title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive('italic')} title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive('underline')} title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive('strike')} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolBtn>
              <div className="capsule-toolbar-divider" />
              <div className="capsule-heading-dropdown" ref={headingMenuRef}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setHeadingMenuOpen(!headingMenuOpen)}
                  className={cn(
                    "capsule-heading-btn",
                    editor.isActive('heading') && "active"
                  )}
                  title="Headings"
                >
                  <span>
                    {editor.isActive('heading', { level: 1 }) ? 'H1' :
                     editor.isActive('heading', { level: 2 }) ? 'H2' :
                     editor.isActive('heading', { level: 3 }) ? 'H3' : 'Text'}
                  </span>
                  <ChevronDown size={12} className={cn("transition-transform", headingMenuOpen && "rotate-180")} />
                </button>
                {headingMenuOpen && (
                  <div className="capsule-heading-menu">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { editor.chain().focus().setParagraph().run(); setHeadingMenuOpen(false); }}
                      className={cn("capsule-heading-option", !editor.isActive('heading') && "active")}
                    >
                      Normal Text
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setHeadingMenuOpen(false); }}
                      className={cn("capsule-heading-option font-extrabold", editor.isActive('heading', { level: 1 }) && "active")}
                    >
                      Heading 1
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setHeadingMenuOpen(false); }}
                      className={cn("capsule-heading-option font-bold", editor.isActive('heading', { level: 2 }) && "active")}
                    >
                      Heading 2
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setHeadingMenuOpen(false); }}
                      className={cn("capsule-heading-option font-semibold", editor.isActive('heading', { level: 3 }) && "active")}
                    >
                      Heading 3
                    </button>
                  </div>
                )}
              </div>
              <ToolBtn active={editor.isActive('bulletList')} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive('orderedList')} title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive('blockquote')} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolBtn>
              <div className="capsule-toolbar-divider" />
              <ToolBtn active={editor.isActive({ textAlign: 'left' })} title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'center' })} title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={15} /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'right' })} title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={15} /></ToolBtn>
              <div className="capsule-toolbar-divider" />
              <ToolBtn active={editor.isActive('link')} title="Link" onClick={setLink}><LinkIcon size={15} /></ToolBtn>
              <ToolBtn active={false} title="Insert image" onClick={() => imageInputRef.current?.click()}><ImageIcon size={15} /></ToolBtn>
            </div>
          )}

          {editMode === 'markdown' && !readOnly && (
            <div className="capsule-markdown-hint">Type Markdown (e.g. <code>**bold**</code>, <code># Heading</code>) — formats live as you type.</div>
          )}

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
              <ToolBtn active={editor.isActive('link')} title="Link" onClick={setLink}><LinkIcon size={14} /></ToolBtn>
              <ToolBtn active={false} title="Insert image" onClick={() => imageInputRef.current?.click()}><ImageIcon size={14} /></ToolBtn>
            </BubbleMenu>
          )}

          {/* Image Bubble Menu — 选中图片时弹出锤子便签样式快捷工具条 */}
          {!readOnly && (
            <BubbleMenu
              editor={editor}
              shouldShow={({ editor }) => editor.isActive('image')}
              className="capsule-image-bubble-menu bg-[#1D1D1F]/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl flex items-center gap-2 z-50 border border-white/10"
            >
              {/* 删除图片按钮 */}
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteSelection().run()}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#FF3B30] text-white hover:bg-[#FF3B30]/80 transition-colors shadow-sm cursor-pointer"
                title="Delete image"
              >
                <Trash2 size={13} />
              </button>

              {/* 放大预览按钮 */}
              <button
                type="button"
                onClick={() => {
                  const attrs = editor.getAttributes('image');
                  if (attrs && attrs.src) {
                    setLightboxZoom(1);
                    setLightboxSrc(attrs.src);
                  }
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors shadow-sm cursor-pointer"
                title="Zoom image"
              >
                <Maximize2 size={13} />
              </button>

              {/* 分割线 */}
              <div className="w-[1px] h-4 bg-white/10 mx-1 flex-shrink-0" />

              {/* 缩放宽度选项 */}
              {['25%', '50%', '75%', '100%'].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('image', { width: w }).run()}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer",
                    editor.getAttributes('image').width === w
                      ? "bg-[#007AFF] text-white"
                      : "text-white/80 hover:bg-white/10"
                  )}
                >
                  {w}
                </button>
              ))}
            </BubbleMenu>
          )}

          {/* 纸张容器 */}
          <div 
            className="w-full flex-1 min-h-[220px] rounded-xl bg-[#FFFBE6] paper-preview p-4 relative"
            style={{ 
              backgroundImage: 'repeating-linear-gradient(to bottom, #FFFBE6, #FFFBE6 calc(2rem - 1px), #F0E6C0 calc(2rem - 1px), #F0E6C0 2rem)', 
              backgroundSize: '100% 2rem', 
              lineHeight: '2rem',
              backgroundAttachment: 'local',
              paddingTop: '1.55rem',
              backgroundPositionY: '1.25rem'
            }}
          >
            {/* Tiptap body — 点击图片通过 NodeSelection 高亮选中 */}
            <EditorContent
              editor={editor}
              className="capsule-editor-content"
              onClick={(e) => {
                const t = e.target as HTMLElement;
                if (t && t.tagName === 'IMG') {
                  e.preventDefault();
                  if (editor) {
                    try {
                      const { state, view } = editor;
                      const pos = view.posAtDOM(t, 0);
                      let selection;
                      try {
                        selection = NodeSelection.create(state.doc, pos);
                      } catch {
                        selection = NodeSelection.create(state.doc, pos - 1);
                      }
                      if (selection) {
                        view.dispatch(state.tr.setSelection(selection));
                        editor.commands.focus();
                      }
                    } catch (err) {
                      console.error("Failed to select image node on click:", err);
                    }
                  }
                }
              }}
            />
          </div>

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
      ) : (
        /* 纯文本模式：展示底层源码（HTML 标记），同样包裹在信纸背景中 */
        <div 
          className="w-full flex-1 min-h-[220px] rounded-xl bg-[#FFFBE6] paper-preview p-4 relative"
          style={{ 
            backgroundImage: 'repeating-linear-gradient(to bottom, #FFFBE6, #FFFBE6 calc(2rem - 1px), #F0E6C0 calc(2rem - 1px), #F0E6C0 2rem)', 
            backgroundSize: '100% 2rem', 
            lineHeight: '2rem',
            backgroundAttachment: 'local',
            paddingTop: '1.55rem',
            backgroundPositionY: '1.25rem'
          }}
        >
          <div className="capsule-plain-editor w-full bg-transparent border-none shadow-none overflow-hidden">
            <textarea
              ref={textareaRef}
              value={plainSource}
              onChange={(e) => handlePlainChange(e.target.value)}
              placeholder={placeholder}
              disabled={readOnly}
              autoFocus={autoFocus}
              spellCheck={false}
              className="w-full min-h-[220px] bg-transparent border-none outline-none resize-none text-[13px] font-mono leading-[2rem] text-[#2c2c2e] placeholder-[#8E8E93]/40 focus:ring-0 focus:border-none focus:outline-none p-0 whitespace-pre-wrap break-words"
            />
          </div>
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

      {/* 图片缩放查看层（Lightbox）：点击图片放大，支持 +/- 与滚轮缩放 */}
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
