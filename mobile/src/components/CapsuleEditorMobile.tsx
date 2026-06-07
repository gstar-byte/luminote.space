import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  useEditorBridge,
  RichText,
  TenTapStartKit,
} from '@10play/tentap-editor';

interface CapsuleEditorMobileProps {
  /** Initial content — either a Tiptap JSON string or legacy HTML/plain text. */
  content: string;
  onChange: (json: string, text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  editMode?: 'plain' | 'markdown' | 'rich';
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
// Editor Component Views
// -----------------------------------------------------------------------------

function WebPlainEditor({
  content,
  onChange,
  placeholder,
  autoFocus,
  editMode,
}: CapsuleEditorMobileProps) {
  const getInitialSource = () => {
    const html = tiptapJsonToHtml(content);
    if (editMode === 'markdown') {
      return htmlToMarkdownPure(html);
    }
    return html; // editMode === 'plain'
  };

  const [draft, setDraft] = useState(getInitialSource());

  useEffect(() => {
    setDraft(getInitialSource());
  }, [content, editMode]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.webInput}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          if (editMode === 'markdown') {
            const compiledHtml = markdownToHtml(t);
            onChange(compiledHtml, t.replace(/[*#`~_\-+[\]()]/g, ''));
          } else {
            onChange(t, t.replace(/<[^>]+>/g, ''));
          }
        }}
        autoFocus={autoFocus}
      />
    </View>
  );
}

function CapsuleEditorNative({
  content,
  onChange,
  placeholder = 'Write your idea...',
  autoFocus = false,
}: CapsuleEditorMobileProps) {
  const getInitialContent = () => {
    if (!content) return '';
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === 'doc') return parsed;
    } catch {
      // already HTML
    }
    return content;
  };

  const editor = useEditorBridge({
    autofocus: autoFocus,
    initialContent: getInitialContent(),
    bridgeExtensions: [...TenTapStartKit],
    onChange: async () => {
      const json = await editor.getJSON();
      const text = await editor.getText();
      onChange(JSON.stringify(json), text);
    },
  });

  return (
    <View style={styles.container}>
      <RichText editor={editor} style={styles.editor} />
      <View style={{ position: 'absolute', top: 4, right: 8, opacity: 0.2 }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#007AFF' }} />
      </View>
    </View>
  );
}

export function CapsuleEditorMobile(props: CapsuleEditorMobileProps) {
  const mode = props.editMode || 'rich';

  if (mode === 'plain' || mode === 'markdown') {
    return <WebPlainEditor {...props} editMode={mode} />;
  }
  if (Platform.OS === 'web') {
    return <WebPlainEditor {...props} editMode="plain" />;
  }
  return <CapsuleEditorNative {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 280,
  },
  editor: {
    flex: 1,
    minHeight: 200,
    padding: 12,
  },
  webInput: {
    flex: 1,
    minHeight: 200,
    padding: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#1D1D1F',
    outlineStyle: 'none' as unknown as undefined,
  },
});
