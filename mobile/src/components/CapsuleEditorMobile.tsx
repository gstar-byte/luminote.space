import React, { useEffect, useState, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  Alert,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  ChevronDown,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';

interface CapsuleEditorMobileProps {
  /** Initial content — either a Tiptap JSON string or legacy HTML/plain text. */
  content: string;
  onChange: (json: string, text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  editMode?: 'plain' | 'markdown';
}

// -----------------------------------------------------------------------------
// Pure JS Conversion Helpers (No DOM dependency, works in React Native)
// -----------------------------------------------------------------------------

function tiptapJsonToHtml(jsonStr: string): string {
  if (!jsonStr) return '';
  try {
    const doc = JSON.parse(jsonStr);
    if (doc?.type !== 'doc' || !Array.isArray(doc.content)) {
      return jsonStr; // Already HTML or plain text
    }
    
    function walk(node: any): string {
      if (!node) return '';
      if (node.type === 'text') {
        let text = node.text || '';
        if (Array.isArray(node.marks)) {
          for (const mark of node.marks) {
            if (mark.type === 'bold' || mark.type === 'strong') text = `<strong>${text}</strong>`;
            else if (mark.type === 'italic' || mark.type === 'em') text = `<em>${text}</em>`;
            else if (mark.type === 'underline') text = `<u>${text}</u>`;
            else if (mark.type === 'strike') text = `<s>${text}</s>`;
            else if (mark.type === 'code') text = `<code>${text}</code>`;
            else if (mark.type === 'link') text = `<a href="${mark.attrs?.href || ''}">${text}</a>`;
          }
        }
        return text;
      }
      
      let childrenText = '';
      if (Array.isArray(node.content)) {
        childrenText = node.content.map(walk).join('');
      }
      
      switch (node.type) {
        case 'paragraph': return `<p>${childrenText}</p>`;
        case 'heading': return `<h${node.attrs?.level || 1}>${childrenText}</h${node.attrs?.level || 1}>`;
        case 'blockquote': return `<blockquote>${childrenText}</blockquote>`;
        case 'bulletList': return `<ul>${childrenText}</ul>`;
        case 'orderedList': return `<ol>${childrenText}</ol>`;
        case 'listItem': return `<li>${childrenText}</li>`;
        case 'codeBlock': return `<pre><code>${childrenText}</code></pre>`;
        case 'hardBreak': return `<br/>`;
        case 'image': return `<img src="${node.attrs?.src || ''}" alt="${node.attrs?.alt || ''}"/>`;
        default: return childrenText;
      }
    }
    
    return doc.content.map(walk).join('');
  } catch {
    return jsonStr;
  }
}

function htmlToMarkdownPure(html: string): string {
  if (!html) return '';
  let md = html;
  
  // Custom underline
  md = md.replace(/<u>([\s\S]*?)<\/u>/gi, '++$1++');
  // Bold
  md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
  // Italic
  md = md.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
  // Strikethrough
  md = md.replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~');
  // Inline code
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');
  
  // Code block
  md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  
  // Headers
  md = md.replace(/<h1>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  
  // Blockquotes
  md = md.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');
  
  // Lists
  md = md.replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul>([\s\S]*?)<\/ul>/gi, '$1\n');
  md = md.replace(/<ol>([\s\S]*?)<\/ol>/gi, '$1\n');
  
  // Paragraphs & Line Breaks
  md = md.replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  
  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Clean up excessive newlines
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md;
  
  // Escape HTML tags to prevent broken rendering
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // Underline
  html = html.replace(/\+\+([^\+]+)\+\+/g, '<u>$1</u>');
  // Bold
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // Code block
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Lists
  html = html.replace(/^\s*[-\*\+] (.*$)/gim, '<li data-type="unordered">$1</li>');
  html = html.replace(/^\s*\d+\. (.*$)/gim, '<li data-type="ordered">$1</li>');

  const lines = html.split('\n');
  let inList: 'unordered' | 'ordered' | null = null;
  const outputLines: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        outputLines.push(inList === 'ordered' ? '</ol>' : '</ul>');
        inList = null;
      }
      return;
    }
    
    const isUnordered = /^<li data-type="unordered">.*<\/li>$/.test(trimmed);
    const isOrdered = /^<li data-type="ordered">.*<\/li>$/.test(trimmed);
    
    if (isUnordered) {
      if (inList !== 'unordered') {
        if (inList) outputLines.push('</ol>');
        inList = 'unordered';
        outputLines.push('<ul>');
      }
      outputLines.push(trimmed.replace(' data-type="unordered"', ''));
    } else if (isOrdered) {
      if (inList !== 'ordered') {
        if (inList) outputLines.push('</ul>');
        inList = 'ordered';
        outputLines.push('<ol>');
      }
      outputLines.push(trimmed.replace(' data-type="ordered"', ''));
    } else {
      if (inList) {
        outputLines.push(inList === 'ordered' ? '</ol>' : '</ul>');
        inList = null;
      }
      outputLines.push(`<p>${trimmed}</p>`);
    }
  });

  if (inList) {
    outputLines.push(inList === 'ordered' ? '</ol>' : '</ul>');
  }

  return outputLines.join('');
}

// -----------------------------------------------------------------------------
// HTML Template for WebView-in-Page contenteditable (WYSIWYG Mode)
// -----------------------------------------------------------------------------

const getHtmlTemplate = (placeholder: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      background-color: #FFFBE6;
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* 固定的网页工具栏：与 Web 端设计对齐，移到屏幕底部（键盘上方） */
    #toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 42px;
      background-color: #FFFCEB;
      border-top: 1px solid #F0E6C0;
      display: flex;
      align-items: center;
      padding: 0 8px;
      z-index: 1000;
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
    }
    #toolbar::-webkit-scrollbar {
      display: none;
    }
    .tool-btn {
      min-width: 34px;
      height: 34px;
      border-radius: 6px;
      border: none;
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-right: 4px;
      cursor: pointer;
      color: #4E4E50;
      padding: 0 6px;
    }
    .tool-btn:active {
      background-color: rgba(0, 122, 255, 0.08);
    }
    .tool-btn.active {
      background-color: rgba(0, 122, 255, 0.08);
      color: #007AFF;
    }
    .tool-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* 滚动容器 */
    #editor-container {
      padding-top: 0px;
      padding-bottom: 42px; /* 给底部固定工具栏预留空间 */
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    #editor {
      outline: none;
      min-height: calc(100% - 20px);
      padding: 12px 16px 150px 16px; /* 底部预留足够滑动空间，方便键盘弹出后输入 */
      background-image: linear-gradient(#F0E6C0 1px, transparent 1px);
      background-size: 100% 32px;
      line-height: 32px;
      font-size: 15px;
      color: #2C2C2E;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    p {
      margin: 0;
      line-height: 32px;
      min-height: 32px;
    }
    h1, h2, h3, blockquote, ul, ol, li {
      margin: 0;
      padding: 0;
      line-height: 32px;
    }
    h1 { font-size: 24px; font-weight: 700; }
    h2 { font-size: 20px; font-weight: 600; }
    h3 { font-size: 17px; font-weight: 600; }
    blockquote {
      border-left: 3px solid #D1C7A3;
      padding-left: 12px;
      color: #636366;
      font-style: italic;
    }
    ul, ol {
      padding-left: 20px;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      display: block;
      margin: 6px 0;
    }
    #editor:empty::before {
      content: attr(placeholder);
      color: #C7C7CC;
      pointer-events: none;
      display: block;
    }
  </style>
</head>
<body>
  <!-- 内部网页工具栏，点击后不丢失编辑区焦点 -->
  <div id="toolbar">
    <!-- H 按钮：无弹出，单键循环修改标题，解决溢出截断问题 -->
    <button type="button" class="tool-btn" id="btn-heading" style="font-weight: 800; font-size: 13px; width: 38px;">
      H
    </button>
    <div style="width: 1px; height: 18px; background-color: rgba(0,0,0,0.1); margin: 0 6px;" />
    
    <button type="button" class="tool-btn" id="btn-bold" title="Bold">
      <svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
    </button>
    <button type="button" class="tool-btn" id="btn-italic" title="Italic">
      <svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
    </button>
    <button type="button" class="tool-btn" id="btn-strike" title="Strikethrough">
      <svg viewBox="0 0 24 24"><path d="M16 4H9a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
    </button>
    <button type="button" class="tool-btn" id="btn-quote" title="Quote">
      <svg viewBox="0 0 24 24"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.97v6c0 1.25.75 2 2 2h3.777C7.777 15.5 7 17.5 3 19v2zM14 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.97v6c0 1.25.75 2 2 2h3.777C18.777 15.5 18 17.5 14 19v2z"/></svg>
    </button>
    <button type="button" class="tool-btn" id="btn-bullet" title="Bullet List">
      <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    </button>
    <button type="button" class="tool-btn" id="btn-ordered" title="Ordered List">
      <svg viewBox="0 0 24 24"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6H2v4h2M4 18H2M2 14h2v4"/></svg>
    </button>
    <button type="button" class="tool-btn" id="btn-image" title="Insert Image">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    </button>
  </div>

  <div id="editor-container">
    <div id="editor" contenteditable="true" placeholder="${placeholder}"></div>
  </div>

  <script>
    const editor = document.getElementById('editor');

    // 彻底防止 iOS/Android WebView 键盘弹出时将 body 顶起，确保 fixed 工具栏永远贴底
    window.addEventListener('scroll', () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    });

    // 焦点回归末尾
    function focusAtEnd() {
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // 获取当前光标所在的块级父节点
    function getActiveBlockNode() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return null;
      let node = selection.anchorNode;
      const blockTags = ['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'DIV', 'LI'];
      while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE && blockTags.includes(node.nodeName)) {
          return node;
        }
        if (node.parentNode === editor) {
          return node;
        }
        node = node.parentNode;
      }
      return null;
    }

    // 格式状态监听，高亮网页工具栏
    function updateToolbarState() {
      document.getElementById('btn-bold').classList.toggle('active', document.queryCommandState('bold'));
      document.getElementById('btn-italic').classList.toggle('active', document.queryCommandState('italic'));
      document.getElementById('btn-strike').classList.toggle('active', document.queryCommandState('strikeThrough'));
      document.getElementById('btn-bullet').classList.toggle('active', document.queryCommandState('insertUnorderedList'));
      document.getElementById('btn-ordered').classList.toggle('active', document.queryCommandState('insertOrderedList'));

      // 检查标题级别以更新 H 按钮上的文字
      let blockNode = getActiveBlockNode();
      let heading = '';
      if (blockNode) {
        const tagName = blockNode.nodeName;
        if (['H1', 'H2', 'H3'].includes(tagName)) {
          heading = tagName.toLowerCase();
        }
      }
      
      const btnHeading = document.getElementById('btn-heading');
      if (heading) {
        btnHeading.innerText = heading.toUpperCase();
        btnHeading.classList.add('active');
      } else {
        btnHeading.innerText = 'H';
        btnHeading.classList.remove('active');
      }
    }

    // 执行富文本格式化指令
    function execFormat(command, value = null) {
      document.execCommand(command, false, value);
      sendContent();
      updateToolbarState();
      focusAtEnd();
    }

    // 内容发生改变，发回 React Native 主体
    function sendContent() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'change',
        html: editor.innerHTML,
        text: editor.innerText || ''
      }));
    }

    editor.addEventListener('input', sendContent);
    
    // 输入事件和按键监听
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('touchend', updateToolbarState);
    editor.addEventListener('focus', updateToolbarState);

    // 网页工具栏各按钮点击事件处理，防止丢失焦点
    const bindBtn = (id, command, value = null) => {
      const el = document.getElementById(id);
      if (el) {
        const handler = (e) => {
          e.preventDefault();
          execFormat(command, value);
        };
        el.addEventListener('touchstart', handler, { passive: false });
        el.addEventListener('mousedown', handler);
      }
    };

    bindBtn('btn-bold', 'bold');
    bindBtn('btn-italic', 'italic');
    bindBtn('btn-strike', 'strikeThrough');
    bindBtn('btn-quote', 'formatBlock', '<blockquote>');
    bindBtn('btn-bullet', 'insertUnorderedList');
    bindBtn('btn-ordered', 'insertOrderedList');

    function applyHeading(tag) {
      // 黄金延时机制：将选区修改放入 setTimeout 队列，避开物理事件竞争，确保 Selection 光标稳定
      setTimeout(() => {
        try {
          const selection = window.getSelection();
          if (!selection.rangeCount) return;
          
          let blockNode = getActiveBlockNode();
          if (!blockNode || blockNode === editor) {
            execFormat('formatBlock', tag === 'p' ? '<p>' : '<' + tag + '>');
            return;
          }
          
          let newTagName = tag.toLowerCase();
          
          // 如果 blockNode 是直接挂在 editor 下的裸文本节点（nodeType === 3）
          if (blockNode.nodeType === 3) {
            const newBlock = document.createElement(newTagName);
            const parent = blockNode.parentNode;
            if (parent) {
              parent.insertBefore(newBlock, blockNode);
              newBlock.appendChild(blockNode);
              
              const range = document.createRange();
              range.selectNodeContents(newBlock);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              
              sendContent();
              updateToolbarState();
            }
            return;
          }
          
          // 元素节点的标签替换逻辑
          let oldTagName = blockNode.nodeName.toLowerCase();
          if (oldTagName === newTagName && newTagName !== 'p') {
            newTagName = 'p'; // 已是此标题，则退回为普通段落
          }
          
          if (oldTagName === newTagName) return;
          
          const newBlock = document.createElement(newTagName);
          while (blockNode.firstChild) {
            newBlock.appendChild(blockNode.firstChild);
          }
          
          if (!newBlock.hasChildNodes()) {
            newBlock.appendChild(document.createElement('br'));
          }
          
          if (blockNode.parentNode) {
            blockNode.parentNode.replaceChild(newBlock, blockNode);
            
            const range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            
            sendContent();
            updateToolbarState();
          }
        } catch (err) {
          console.warn('Heading format error, falling back to basic command:', err);
          execFormat('formatBlock', tag === 'p' ? '<p>' : '<' + tag + '>');
        }
      }, 10);
    }

    const btnHeading = document.getElementById('btn-heading');
    if (btnHeading) {
      const headingHandler = (e) => {
        e.preventDefault();
        let blockNode = getActiveBlockNode();
        let currentTag = 'p';
        if (blockNode) {
          const tagName = blockNode.nodeName.toUpperCase();
          if (['H1', 'H2', 'H3'].includes(tagName)) {
            currentTag = tagName.toLowerCase();
          }
        }
        
        let nextTag = 'h1';
        if (currentTag === 'h1') nextTag = 'h2';
        else if (currentTag === 'h2') nextTag = 'h3';
        else if (currentTag === 'h3') nextTag = 'p';
        
        applyHeading(nextTag);
      };
      btnHeading.addEventListener('touchstart', headingHandler, { passive: false });
      btnHeading.addEventListener('mousedown', headingHandler);
    }

    // 选取图片发回 RN
    const btnImage = document.getElementById('btn-image');
    if (btnImage) {
      const pickImgHandler = (e) => {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pickImage'
        }));
      };
      btnImage.addEventListener('touchstart', pickImgHandler, { passive: false });
      btnImage.addEventListener('mousedown', pickImgHandler);
    }

    // 全局接口
    window.setContent = function(html) {
      editor.innerHTML = html;
      sendContent();
    };

    window.focusEditor = function() {
      focusAtEnd();
    };

    window.insertImage = function(base64Url) {
      execFormat('insertHTML', '<img src="' + base64Url + '" style="width: 100%; max-width: 100%; border-radius: 8px; display: block; margin: 8px 0;" />');
    };
  </script>
</body>
</html>
`;

// -----------------------------------------------------------------------------
// Editor Component
// -----------------------------------------------------------------------------

export function CapsuleEditorMobile({
  content,
  onChange,
  placeholder = 'Write your idea...',
  autoFocus = false,
  editMode = 'plain',
}: CapsuleEditorMobileProps) {
  const getInitialSource = () => {
    const html = tiptapJsonToHtml(content);
    if (editMode === 'plain') {
      return htmlToMarkdownPure(html);
    }
    return html;
  };

  const [draft, setDraft] = useState(getInitialSource());
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const inputRef = useRef<TextInput>(null);
  const webviewRef = useRef<WebView>(null);
  const isWebViewLoaded = useRef(false);
  const lastHtmlSent = useRef('');

  useEffect(() => {
    setDraft(getInitialSource());
  }, [content, editMode]);

  const updateDraftAndNotify = (newText: string, newSelectionStart: number, newSelectionEnd?: number) => {
    setDraft(newText);
    if (editMode === 'plain') {
      const compiledHtml = markdownToHtml(newText);
      onChange(compiledHtml, newText.replace(/[*#`~_\-+[\]()]/g, ''));
    } else {
      onChange(newText, newText.replace(/<[^>]+>/g, ''));
    }

    const targetEnd = newSelectionEnd ?? newSelectionStart;
    setTimeout(() => {
      inputRef.current?.focus();
      setSelection({ start: newSelectionStart, end: targetEnd });
    }, 50);
  };

  const toggleHeadingMarkdown = () => {
    const { start } = selection;
    let lineStart = draft.lastIndexOf('\n', start - 1);
    if (lineStart === -1) {
      lineStart = 0;
    } else {
      lineStart += 1;
    }

    let lineEnd = draft.indexOf('\n', start);
    if (lineEnd === -1) {
      lineEnd = draft.length;
    }

    const currentLine = draft.substring(lineStart, lineEnd);
    let newLine = currentLine;
    let offset = 0;

    if (currentLine.startsWith('### ')) {
      newLine = currentLine.substring(4);
      offset = -4;
    } else if (currentLine.startsWith('## ')) {
      newLine = '### ' + currentLine.substring(3);
      offset = 1;
    } else if (currentLine.startsWith('# ')) {
      newLine = '## ' + currentLine.substring(2);
      offset = 1;
    } else {
      newLine = '# ' + currentLine;
      offset = 2;
    }

    const before = draft.substring(0, lineStart);
    const after = draft.substring(lineEnd);
    const nextText = before + newLine + after;

    const newCursorPos = Math.max(lineStart, start + offset);
    updateDraftAndNotify(nextText, newCursorPos);
  };

  const getHeadingButtonText = () => {
    const { start } = selection;
    let lineStart = draft.lastIndexOf('\n', start - 1);
    if (lineStart === -1) {
      lineStart = 0;
    } else {
      lineStart += 1;
    }
    let lineEnd = draft.indexOf('\n', start);
    if (lineEnd === -1) {
      lineEnd = draft.length;
    }
    const fullLine = draft.substring(lineStart, lineEnd);

    if (fullLine.startsWith('### ')) return 'H3';
    if (fullLine.startsWith('## ')) return 'H2';
    if (fullLine.startsWith('# ')) return 'H1';
    return 'H';
  };

  const insertMarkdown = async (type: 'bold' | 'italic' | 'strike' | 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'ordered' | 'image') => {
    const { start, end } = selection;
    const selectedText = draft.substring(start, end);
    let inserted = '';
    let newStart = start;
    let newEnd = end;

    if (type === 'image') {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'We need access to your photos to insert images.');
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
        return;
      }
      const base64Url = `data:image/jpeg;base64,${pickerResult.assets[0].base64 || ''}`;
      inserted = `\n![image](${base64Url})\n`;
      const before = draft.substring(0, start);
      const after = draft.substring(end);
      const nextText = before + inserted + after;
      newStart = start + inserted.length;
      updateDraftAndNotify(nextText, newStart);
      return;
    }

    if (type === 'bold') {
      if (start !== end) {
        inserted = `**${selectedText}**`;
        newStart = start;
        newEnd = end + 4;
      } else {
        inserted = '****';
        newStart = start + 2;
        newEnd = newStart;
      }
    } else if (type === 'italic') {
      if (start !== end) {
        inserted = `*${selectedText}*`;
        newStart = start;
        newEnd = end + 2;
      } else {
        inserted = '**';
        newStart = start + 1;
        newEnd = newStart;
      }
    } else if (type === 'strike') {
      if (start !== end) {
        inserted = `~~${selectedText}~~`;
        newStart = start;
        newEnd = end + 4;
      } else {
        inserted = '~~~~';
        newStart = start + 2;
        newEnd = newStart;
      }
    } else {
      const prefix = (start > 0 && draft[start - 1] !== '\n') ? '\n' : '';
      if (type === 'h1') {
        inserted = `${prefix}# `;
      } else if (type === 'h2') {
        inserted = `${prefix}## `;
      } else if (type === 'h3') {
        inserted = `${prefix}### `;
      } else if (type === 'quote') {
        inserted = `${prefix}> `;
      } else if (type === 'bullet') {
        inserted = `${prefix}- `;
      } else if (type === 'ordered') {
        inserted = `${prefix}1. `;
      }
      newStart = start + inserted.length;
      newEnd = newStart;
    }

    const before = draft.substring(0, start);
    const after = draft.substring(end);
    const nextText = before + inserted + after;
    updateDraftAndNotify(nextText, newStart, newEnd);
  };

  // 接收从 WebView 传回的消息
  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'change') {
        lastHtmlSent.current = msg.html;
        onChange(msg.html, msg.text);
      }
      // 触发相册选图
      if (msg.type === 'pickImage') {
        void (async () => {
          const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permissionResult.granted) {
            Alert.alert('Permission required', 'We need access to your photos to insert images.');
            return;
          }
          const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          });
          if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
            return;
          }
          const asset = pickerResult.assets[0];
          const base64Url = `data:image/jpeg;base64,${asset.base64 || ''}`;
          // 极速注入 WebView 并就地插入图片，焦点不发生变化
          webviewRef.current?.injectJavaScript(`window.insertImage(${JSON.stringify(base64Url)});`);
        })();
      }
    } catch (e) {
      console.warn('WebView message error:', e);
    }
  };

  const handleWebViewLoadEnd = () => {
    isWebViewLoaded.current = true;
    const initialHtml = tiptapJsonToHtml(content);
    lastHtmlSent.current = initialHtml;
    webviewRef.current?.injectJavaScript(`
      window.setContent(${JSON.stringify(initialHtml)});
      if (${autoFocus}) {
        window.focusEditor();
      }
    `);
  };

  return (
    <View style={styles.container}>
      {/* 笔记本背景横线：仅在原生 plain 模式渲染（WebView 内部已自绘横线，防止重叠） */}
      {editMode === 'plain' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 50 }).map((_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: i * 32 + 32,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: '#F0E6C0',
              }}
            />
          ))}
        </View>
      )}

      {/* 编辑体 */}
      {editMode === 'plain' ? (
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              key="plain-native-text-input"
              ref={inputRef}
              style={styles.webInput}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              placeholder={placeholder}
              placeholderTextColor="#C7C7CC"
              value={draft}
              selection={selection}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              onChangeText={(t) => {
                setDraft(t);
                const compiledHtml = markdownToHtml(t);
                onChange(compiledHtml, t.replace(/[*#`~_\-+[\]()]/g, ''));
              }}
              autoFocus={autoFocus}
            />
          </ScrollView>

          {/* 原生快捷工具栏：锤子便签风格 */}
          <View style={styles.nativeToolbar}>
            <TouchableOpacity
              onPress={() => toggleHeadingMarkdown()}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.nativeToolText}>{getHeadingButtonText()}</Text>
            </TouchableOpacity>
            
            <View style={styles.nativeToolbarDivider} />

            <TouchableOpacity
              onPress={() => insertMarkdown('bold')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <Bold size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => insertMarkdown('italic')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <Italic size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => insertMarkdown('strike')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <Strikethrough size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => insertMarkdown('quote')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <Quote size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => insertMarkdown('bullet')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <List size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => insertMarkdown('ordered')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <ListOrdered size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => insertMarkdown('image')}
              style={styles.nativeToolBtn}
              activeOpacity={0.7}
            >
              <ImageIcon size={16} color="#4E4E50" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View key="markdown-webview-container" style={styles.webviewContainer}>
          <WebView
            ref={webviewRef}
            source={{ html: getHtmlTemplate(placeholder) }}
            onMessage={handleMessage}
            onLoadEnd={handleWebViewLoadEnd}
            style={{ backgroundColor: '#FFFBE6', flex: 1 }}
            originWhitelist={['*']}
            keyboardDisplayRequiresUserAction={false}
            scrollEnabled={true} // 启用 WebView 原生滚动
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBE6',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    flex: 1, // Markdown 模式满高拉伸，Plain 模式由外部 ScrollView 承载
    minHeight: 400,
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: 16, // 加上左右外边距以形成圆角便签纸卡悬浮的视觉对齐
  },
  webInput: {
    minHeight: 750, // 原生 Plain 输入框高度调大 30%
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 32,
    color: '#2C2C2E',
    ...Platform.select({
      web: { outlineStyle: 'none' as any },
    }),
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#FFFBE6',
  },
  nativeToolbar: {
    height: 42,
    backgroundColor: '#FFFCEB',
    borderTopWidth: 1,
    borderTopColor: '#F0E6C0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  nativeToolBtn: {
    minWidth: 34,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  nativeToolText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4E4E50',
    letterSpacing: 0.5,
  },
  nativeToolbarDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 6,
  },
});
