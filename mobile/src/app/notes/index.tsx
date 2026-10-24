import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { getDatabase } from "../../lib/db/open";
import { loadNotes } from "../../lib/learner/queries";
import { useLoad } from "../../lib/hooks/useLoad";
import { learner } from "../../lib/sync/runtime";
import { checkNote, parseTags } from "../../lib/rules/note";
import { Button, Empty, Field, Notice } from "../../components/common/Controls";
import { makeStyles } from "../../lib/ui/theme";
import type { ServerNote } from "../../lib/api/types";

export default function NotesScreen() {
  const { s } = useStyles();
  const notes = useLoad(async () => loadNotes(await getDatabase()), "notes");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    const check = checkNote(title, body);
    if (!check.ok) return setMessage(check.error);
    const parsed = parseTags(tags);
    if (!parsed.ok) return setMessage(parsed.error);
    const r = await learner.addNote(title.trim(), body.trim(), parsed.tags);
    if (!r.applied) return setMessage("This note can't be saved right now.");
    setTitle(""); setBody(""); setTags(""); setAdding(false); setMessage("Saved on this device. It will sync when you are online.");
    notes.reload();
  };

  const remove = async (n: ServerNote) => {
    const r = await learner.deleteNote(n.id);
    setMessage(r.applied ? "Note deleted." : "This note can't be deleted right now.");
    if (r.applied) notes.reload();
  };

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.content}
      data={notes.data ?? []}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={
        <View style={s.header}>
          {message ? <Notice text={message} /> : null}
          {adding ? (
            <View style={s.form}>
              <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
              <Field label="Note" value={body} onChangeText={setBody} multiline />
              <Field label="Tags" hint="Up to five, separated by commas, for example: heap, graphs" value={tags} onChangeText={setTags} autoCapitalize="none" />
              <Button label="Save note" variant="primary" onPress={save} />
              <Button label="Cancel" onPress={() => { setAdding(false); setMessage(null); }} />
            </View>
          ) : (
            <Button label="Add a note" variant="primary" onPress={() => setAdding(true)} />
          )}
        </View>
      }
      ListEmptyComponent={<Empty text="No notes yet. Notes you write are kept on this device and sync to your account." />}
      renderItem={({ item }) => (
        <View style={s.card} accessibilityLabel={`Note: ${item.title}`}>
          <Text style={s.cardTitle}>{item.title}</Text>
          <Text style={s.body}>{item.body}</Text>
          {item.tags.length > 0 ? <Text style={s.tags}>{item.tags.map((t) => `#${t}`).join("  ")}</Text> : null}
          <Button label={`Delete note: ${item.title}`} variant="danger" onPress={() => remove(item)} />
        </View>
      )}
    />
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 6 },
  form: { gap: 10, backgroundColor: c.surface, borderRadius: 12, padding: 14 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, gap: 8 },
  cardTitle: { color: c.fg, fontSize: 17, fontFamily: f.bold },
  body: { color: c.fg, fontSize: 15, lineHeight: 22 },
  tags: { color: c.brand, fontSize: 14 },
}));
