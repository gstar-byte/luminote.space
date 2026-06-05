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
  /** Initial content — either a Tiptap JSON string or legacy plain text. */
  content: string;
  onChange: (json: string, text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function plainTextFromStored(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type !== 'doc' || !Array.isArray(parsed.content)) return raw;
    const lines: string[] = [];
    const walk = (nodes: unknown[]) => {
      for (const node of nodes as { type?: string; text?: string; content?: unknown[] }[]) {
        if (node.type === 'text') lines.push(node.text || '');
        else if (node.type === 'hardBreak') lines.push(' ');
        else if (node.content) walk(node.content);
        else if (['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList'].includes(node.type ?? '')) {
          lines.push(' ');
        }
      }
    };
    walk(parsed.content);
    return lines.join('').trim();
  } catch {
    return raw;
  }
}

function textToDocJson(text: string): string {
  const trimmed = text ?? '';
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: trimmed ? [{ type: 'text', text: trimmed }] : [],
      },
    ],
  });
}

function WebPlainEditor({
  content,
  onChange,
  placeholder,
  autoFocus,
}: CapsuleEditorMobileProps) {
  const initial = plainTextFromStored(content);
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    setDraft(plainTextFromStored(content));
  }, [content]);

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
          onChange(textToDocJson(t), t);
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
      // plain text
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
  if (Platform.OS === 'web') {
    return <WebPlainEditor {...props} />;
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
    fontSize: 16,
    fontWeight: '500',
    color: '#1D1D1F',
    outlineStyle: 'none' as unknown as undefined,
  },
});
