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
  Image,
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
  X,
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
  isMetaFocused?: boolean;
  attachments?: any[];
  onRemoveAttachment?: (index: number) => void;
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
  
  // Paragraphs & Line Breaks (Supporting attributes like style/class)
  md = md.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\b[^>]*\/?>/gi, '\n');
  
  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  // Force remove any leftover unclosed <p>, </p> or <br> strings as extra safety guard
  md = md.replace(/<\/?p\b[^>]*>?/gi, '');
  md = md.replace(/<br\b[^>]*\/?>?/gi, '');
  
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
      outputLines.push('<p><br></p>');
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
    
    #editor-container {
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      position: relative;
    }
    #editor {
      outline: none;
      min-height: calc(100% - 20px);
      padding: 8px 16px 150px 16px;
      background-image: linear-gradient(#F0E6C0 1px, transparent 1px);
      background-size: 100% 32px;
      background-position-y: 40px;
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
      cursor: pointer;
      transition: outline 0.1s;
    }
    img.selected-img {
      outline: 3px solid #007AFF;
      outline-offset: 2px;
    }
    #editor:empty::before {
      content: attr(placeholder);
      color: #C7C7CC;
      pointer-events: none;
      display: block;
    }

    /* Image bubble menu style */
    #image-bubble {
      position: absolute;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(29, 29, 31, 0.95);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 10000;
    }
    .bubble-divider {
      width: 1px;
      height: 14px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0 2px;
    }
    .bubble-btn {
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.8);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.1s;
    }
    .bubble-btn:active {
      background: rgba(255, 255, 255, 0.15);
      color: #FFF;
    }
    .bubble-btn.del-btn {
      background: #FF3B30;
      color: #FFF;
      padding: 4px 8px;
    }
    .bubble-btn.del-btn:active {
      background: #FF453A;
    }
  </style>
</head>
<body>
  <div id="editor-container">
    <div id="editor" contenteditable="true" placeholder="${placeholder}"></div>
    
    <!-- Image bubble markup -->
    <div id="image-bubble">
      <button type="button" id="btn-del-img" class="bubble-btn del-btn" title="Delete image">DEL</button>
      <div class="bubble-divider"></div>
      <button type="button" class="bubble-btn" data-width="25%">25%</button>
      <button type="button" class="bubble-btn" data-width="50%">50%</button>
      <button type="button" class="bubble-btn" data-width="75%">75%</button>
      <button type="button" class="bubble-btn" data-width="100%">100%</button>
    </div>
  </div>

  <script>
    // 捕获页面上的未捕获异常并传回 React Native
    window.onerror = function(message, source, lineno, colno, error) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'webview-error',
          message: message,
          line: lineno,
          column: colno
        }));
      }
      return false;
    };

    // 重写 console.log, console.warn, console.error，把它们发送给 React Native
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };
    console.log = function() {
      originalConsole.log.apply(console, arguments);
      const args = Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'webview-log', level: 'log', message: args }));
      }
    };
    console.warn = function() {
      originalConsole.warn.apply(console, arguments);
      const args = Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'webview-log', level: 'warn', message: args }));
      }
    };
    console.error = function() {
      originalConsole.error.apply(console, arguments);
      const args = Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'webview-log', level: 'error', message: args }));
      }
    };

    const editor = document.getElementById('editor');
    let hasBeenEdited = false;
    let isFirstLoad = true;

    window.addEventListener('scroll', () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    });

    function focusAtEnd() {
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

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

    // 将格式和 Heading 状态打包发送回 React Native
    function updateToolbarState() {
      let blockNode = getActiveBlockNode();
      let heading = '';
      if (blockNode) {
        const tagName = blockNode.nodeName;
        if (['H1', 'H2', 'H3'].includes(tagName)) {
          heading = tagName.toLowerCase();
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'state',
        heading: heading,
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        strike: document.queryCommandState('strikeThrough'),
        bullet: document.queryCommandState('insertUnorderedList'),
        ordered: document.queryCommandState('insertOrderedList')
      }));
    }

    function execFormat(command, value = null) {
      document.execCommand(command, false, value);
      sendContent();
      updateToolbarState();
    }

    window.execFormat = execFormat;

    function sendContent() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'change',
        html: editor.innerHTML,
        text: editor.innerText || ''
      }));
    }

    editor.addEventListener('input', () => {
      hasBeenEdited = true;
      sendContent();
    });
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('touchend', updateToolbarState);
    editor.addEventListener('focus', updateToolbarState);

    // 单键循环标题切换 API，供 RN 端调用
    window.applyHeadingToggle = function() {
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

    function applyHeading(tag) {
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
          
          let oldTagName = blockNode.nodeName.toLowerCase();
          if (oldTagName === newTagName && newTagName !== 'p') {
            newTagName = 'p';
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
          console.warn('Heading format error:', err);
          execFormat('formatBlock', tag === 'p' ? '<p>' : '<' + tag + '>');
        }
      }, 10);
    }

    // 全局接口
    window.setContent = function(html) {
      if (!isFirstLoad && hasBeenEdited) {
        return;
      }
      let processed = html || '';
      if (processed && !processed.trim().startsWith('<') && !processed.includes('</')) {
        processed = processed
          .split('\\n')
          .map(line => '<p>' + (line ? line : '<br>') + '</p>')
          .join('');
      } else {
        processed = processed.replace(/([^>])\\n([^<])/g, '$1<br>$2');
      }
      editor.innerHTML = processed;
      sendContent();
      isFirstLoad = false;
    };

    window.setContentEncoded = function(encodedHtml) {
      window.setContent(decodeURIComponent(encodedHtml));
    };

    window.focusEditor = function() {
      focusAtEnd();
    };

    window.insertImage = function(base64Url) {
      execFormat('insertHTML', '<img src="' + base64Url + '" style="width: 100%; max-width: 100%; border-radius: 8px; display: block; margin: 8px 0;" />');
    };

    window.insertImageEncoded = function(encodedImg) {
      window.insertImage(decodeURIComponent(encodedImg));
    };

    // 图片气泡与大小缩放功能对齐 Web 端
    let activeImg = null;
    const imageBubble = document.getElementById('image-bubble');

    function hideImageBubble() {
      if (activeImg) {
        activeImg.classList.remove('selected-img');
        activeImg = null;
      }
      imageBubble.style.display = 'none';
    }

    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG' && editor.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        
        if (activeImg) {
          activeImg.classList.remove('selected-img');
        }
        
        activeImg = e.target;
        activeImg.classList.add('selected-img');
        
        const rect = activeImg.getBoundingClientRect();
        const scrollContainer = document.getElementById('editor-container');
        
        imageBubble.style.display = 'flex';
        const bubbleWidth = 220;
        const left = rect.left + (rect.width - bubbleWidth) / 2;
        const top = rect.top + scrollContainer.scrollTop - 38;
        
        imageBubble.style.left = Math.max(10, Math.min(window.innerWidth - bubbleWidth - 10, left)) + 'px';
        imageBubble.style.top = Math.max(10, top) + 'px';
        
        const currentWidth = activeImg.style.width || '100%';
        const buttons = imageBubble.querySelectorAll('.bubble-btn');
        buttons.forEach(btn => {
          if (btn.getAttribute('data-width') === currentWidth) {
            btn.style.backgroundColor = '#007AFF';
            btn.style.color = '#FFF';
          } else {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'rgba(255,255,255,0.8)';
          }
        });
        return;
      }

      if (imageBubble.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        
        const width = e.target.getAttribute('data-width');
        if (width && activeImg) {
          activeImg.style.width = width;
          sendContent();
          
          const buttons = imageBubble.querySelectorAll('.bubble-btn');
          buttons.forEach(btn => {
            if (btn.getAttribute('data-width') === width) {
              btn.style.backgroundColor = '#007AFF';
              btn.style.color = '#FFF';
            } else {
              btn.style.backgroundColor = 'transparent';
              btn.style.color = 'rgba(255,255,255,0.8)';
            }
          });
        }
        return;
      }

      hideImageBubble();
    });

    const btnDelImg = document.getElementById('btn-del-img');
    if (btnDelImg) {
      btnDelImg.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeImg) {
          activeImg.remove();
          sendContent();
          hideImageBubble();
        }
      });
    }

    document.getElementById('editor-container').addEventListener('scroll', hideImageBubble);
    
    // 监听来自 React Native 端的安全消息通信通道
    function handleReceiveMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'setContent') {
          if (window.setContent) {
            window.setContent(data.html);
          }
        } else if (data.type === 'execFormat') {
          if (window.execFormat) {
            window.execFormat(data.command, data.value);
          }
        } else if (data.type === 'applyHeadingToggle') {
          if (window.applyHeadingToggle) {
            window.applyHeadingToggle();
          }
        } else if (data.type === 'insertImage') {
          if (window.insertImage) {
            window.insertImage(data.base64Url);
          }
        }
      } catch (err) {
        console.warn('WebView parse message error:', err);
      }
    }
    
    window.addEventListener('message', handleReceiveMessage);
    document.addEventListener('message', handleReceiveMessage);
    
    // 安全发送 ready 信号：轮询确保 window.ReactNativeWebView 已经成功被原生层注入，避免同步抛错崩溃
    function sendReadyWhenAvailable() {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        } catch (err) {
          console.warn('postMessage failed, retrying...', err);
          setTimeout(sendReadyWhenAvailable, 30);
        }
      } else {
        setTimeout(sendReadyWhenAvailable, 30);
      }
    }
    
    if (document.readyState === 'complete') {
      sendReadyWhenAvailable();
    } else {
      window.addEventListener('load', sendReadyWhenAvailable);
    }
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
  isMetaFocused = false,
  attachments = [],
  onRemoveAttachment,
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
  const [webviewState, setWebviewState] = useState({
    heading: '',
    bold: false,
    italic: false,
    strike: false,
    bullet: false,
    ordered: false,
  });

  const inputRef = useRef<TextInput>(null);
  const webviewRef = useRef<WebView>(null);
  const isWebViewLoaded = useRef(false);
  const lastHtmlSent = useRef('');

  const latestContentRef = useRef<{ html: string; text: string } | null>(null);
  const debounceTimeout = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
        if (latestContentRef.current) {
          onChange(latestContentRef.current.html, latestContentRef.current.text);
        }
      }
    };
  }, [onChange]);

  useEffect(() => {
    setDraft(getInitialSource());
  }, [editMode]);

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

  const handleNativeToolbarPress = async (type: 'bold' | 'italic' | 'strike' | 'quote' | 'bullet' | 'ordered' | 'image' | 'heading') => {
    if (editMode === 'plain') {
      if (type === 'heading') {
        toggleHeadingMarkdown();
      } else {
        await insertMarkdown(type);
      }
    } else {
      if (!isWebViewLoaded.current || !webviewRef.current) return;
      
      if (type === 'heading') {
        webviewRef.current.injectJavaScript(`if(window.applyHeadingToggle){window.applyHeadingToggle();} true;`);
      } else if (type === 'bold') {
        webviewRef.current.injectJavaScript(`if(window.execFormat){window.execFormat("bold");} true;`);
      } else if (type === 'italic') {
        webviewRef.current.injectJavaScript(`if(window.execFormat){window.execFormat("italic");} true;`);
      } else if (type === 'strike') {
        webviewRef.current.injectJavaScript(`if(window.execFormat){window.execFormat("strikeThrough");} true;`);
      } else if (type === 'quote') {
        webviewRef.current.injectJavaScript(`if(window.execFormat){window.execFormat("formatBlock", "<blockquote>");} true;`);
      } else if (type === 'bullet') {
        webviewRef.current.injectJavaScript(`if(window.execFormat){window.execFormat("insertUnorderedList");} true;`);
      } else if (type === 'ordered') {
        webviewRef.current.injectJavaScript(`if(window.execFormat){window.execFormat("insertOrderedList");} true;`);
      } else if (type === 'image') {
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
        const encodedImg = encodeURIComponent(base64Url);
        webviewRef.current.injectJavaScript(`if(window.insertImageEncoded){window.insertImageEncoded("${encodedImg}");} true;`);
      }
    }
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
      if (msg.type === 'webview-error') {
        console.error('🔴 [WebView Error]', msg.message, `at line ${msg.line}:${msg.column}`);
        return;
      }
      if (msg.type === 'webview-log') {
        console.log(`[WebView Console ${msg.level.toUpperCase()}]`, msg.message);
        return;
      }
      if (msg.type === 'ready') {
        isWebViewLoaded.current = true;
        const initialHtml = tiptapJsonToHtml(content);
        lastHtmlSent.current = initialHtml;
        
        const encodedHtml = encodeURIComponent(initialHtml);
        webviewRef.current?.injectJavaScript(`
          if (window.setContentEncoded) {
            window.setContentEncoded("${encodedHtml}");
          }
          true;
        `);

        if (autoFocus) {
          webviewRef.current?.injectJavaScript(`
            if (window.focusEditor) {
              window.focusEditor();
            }
          `);
        }
        return;
      }
      if (msg.type === 'change') {
        lastHtmlSent.current = msg.html;
        latestContentRef.current = { html: msg.html, text: msg.text };

        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
          onChange(msg.html, msg.text);
        }, 250);
      }
      if (msg.type === 'state') {
        setWebviewState({
          heading: msg.heading || '',
          bold: !!msg.bold,
          italic: !!msg.italic,
          strike: !!msg.strike,
          bullet: !!msg.bullet,
          ordered: !!msg.ordered,
        });
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
          const encodedImg = encodeURIComponent(base64Url);
          webviewRef.current?.injectJavaScript(`if(window.insertImageEncoded){window.insertImageEncoded("${encodedImg}");} true;`);
        })();
      }
    } catch (e) {
      console.warn('WebView message error:', e);
    }
  };

  const handleWebViewLoadEnd = () => {
    isWebViewLoaded.current = true;
  };

  const isBtnActive = (type: string) => {
    if (editMode === 'plain') return false;
    if (type === 'bold') return webviewState.bold;
    if (type === 'italic') return webviewState.italic;
    if (type === 'strike') return webviewState.strike;
    if (type === 'bullet') return webviewState.bullet;
    if (type === 'ordered') return webviewState.ordered;
    return false;
  };

  const getHeadingText = () => {
    if (editMode === 'plain') {
      return getHeadingButtonText();
    }
    return webviewState.heading ? webviewState.heading.toUpperCase() : 'H';
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
                top: i * 32 + 40,
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
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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

            {attachments && attachments.length > 0 ? (
              <View style={{ marginTop: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
                {attachments.map((a, i) => (
                  <View key={`att-${i}-${a.url.slice(0, 15)}`} style={{ marginTop: 12 }}>
                    <View style={{ position: 'relative' }}>
                      {a.type === 'image' ? (
                        <Image source={{ uri: a.url }} style={{ width: '100%', height: 180, borderRadius: 12 }} />
                      ) : (
                        <View style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFF' }}>Video</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          onRemoveAttachment?.(i);
                        }}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 50,
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: 'rgba(0,0,0,0.55)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <X size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : (
        <>
          <View key="markdown-webview-container" style={styles.webviewContainer}>
            <WebView
              ref={webviewRef}
              source={{ html: getHtmlTemplate(placeholder) }}
              onMessage={handleMessage}
              onLoadEnd={handleWebViewLoadEnd}
              style={{ backgroundColor: '#FFFBE6', flex: 1 }}
              originWhitelist={['*']}
              keyboardDisplayRequiresUserAction={false}
              scrollEnabled={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>

          {/* 原生快捷工具栏：在 Markdown 模式下也展现，解决被键盘遮挡的 WebView 工具栏问题 */}
          {!isMetaFocused && (
            <View style={styles.nativeToolbar}>
              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('heading')}
                style={[styles.nativeToolBtn, (webviewState.heading !== '') && { backgroundColor: 'rgba(0, 122, 255, 0.08)' }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.nativeToolText, { color: (webviewState.heading !== '') ? '#007AFF' : '#4E4E50' }]}>
                  {getHeadingText()}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.nativeToolbarDivider} />

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('bold')}
                style={[styles.nativeToolBtn, isBtnActive('bold') && { backgroundColor: 'rgba(0, 122, 255, 0.08)' }]}
                activeOpacity={0.7}
              >
                <Bold size={16} color={isBtnActive('bold') ? '#007AFF' : '#4E4E50'} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('italic')}
                style={[styles.nativeToolBtn, isBtnActive('italic') && { backgroundColor: 'rgba(0, 122, 255, 0.08)' }]}
                activeOpacity={0.7}
              >
                <Italic size={16} color={isBtnActive('italic') ? '#007AFF' : '#4E4E50'} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('strike')}
                style={[styles.nativeToolBtn, isBtnActive('strike') && { backgroundColor: 'rgba(0, 122, 255, 0.08)' }]}
                activeOpacity={0.7}
              >
                <Strikethrough size={16} color={isBtnActive('strike') ? '#007AFF' : '#4E4E50'} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('quote')}
                style={styles.nativeToolBtn}
                activeOpacity={0.7}
              >
                <Quote size={16} color="#4E4E50" strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('bullet')}
                style={[styles.nativeToolBtn, isBtnActive('bullet') && { backgroundColor: 'rgba(0, 122, 255, 0.08)' }]}
                activeOpacity={0.7}
              >
                <List size={16} color={isBtnActive('bullet') ? '#007AFF' : '#4E4E50'} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('ordered')}
                style={[styles.nativeToolBtn, isBtnActive('ordered') && { backgroundColor: 'rgba(0, 122, 255, 0.08)' }]}
                activeOpacity={0.7}
              >
                <ListOrdered size={16} color={isBtnActive('ordered') ? '#007AFF' : '#4E4E50'} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleNativeToolbarPress('image')}
                style={styles.nativeToolBtn}
                activeOpacity={0.7}
              >
                <ImageIcon size={16} color="#4E4E50" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}
        </>
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
