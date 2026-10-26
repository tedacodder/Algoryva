import { useState } from "react";
import { Linking, ScrollView, Share, View } from "react-native";
import { clearReports, reportsText } from "../../lib/diagnostics/install";
import { forceFullRefresh } from "../../lib/content/refresh";
import { getDatabase } from "../../lib/db/open";
import Constants from "expo-constants";
import { router } from "expo-router";
import { api, isSignedIn } from "../../lib/auth/session";
import { clearLocalData } from "../../lib/sync/runtime";
import { API_BASE_URL } from "../../lib/config";
import { Button, Notice, Tabs } from "../../components/common/Controls";
import { makeStyles, useTheme, type Preference } from "../../lib/ui/theme";
import { Card, H, P } from "../../components/common/Ui";

/** Settings: what is stored on the device, privacy, account deletion, clearing data, and about. */
export default function SettingsScreen() {
  const { preference, setPreference, mode } = useTheme();
  const { s } = useStyles();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contentNote, setContentNote] = useState<string | null>(null);
  const signedIn = isSignedIn();
  const version = Constants.expoConfig?.version ?? "unknown";

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Card>
        <H level={2}>Appearance</H>
        <P>{`Light or dark. "System" follows your phone (currently ${mode}).`}</P>
        <Tabs<Preference>
          label="Appearance"
          value={preference}
          onChange={setPreference}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Card>

      <Card>
        <H level={2}>Data on this device</H>
        <P>Lessons and problems are downloaded once and work offline. Your progress, notes, mistakes and answers are kept on this device,
          and when you are signed in they sync to your account.</P>
      </Card>

      <Card>
        <H level={2}>Privacy</H>
        <P>Read how your data is used, stored and deleted.</P>
        <Button label="Open the privacy policy" hint="Opens the policy in your browser" onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)} />
      </Card>

      <Card>
        <H level={2}>Share</H>
        <P>Know someone who wants to learn algorithms? Send them the app.</P>
        <Button label="Share Algoryva" onPress={() => void Share.share({ message: "Learn algorithms and Python with Algoryva: lessons, quizzes and a Python runner that works offline." })} />
      </Card>

      <Card>
        <H level={2}>Lessons and problems</H>
        <P>Downloads the newest lessons, quizzes and problems from the server now.</P>
        <Button label="Update content now" hint="Downloads everything again and shows what arrived" onPress={async () => {
          try {
            const r = await forceFullRefresh(await getDatabase(), api);
            setContentNote(`Updated: ${r.topics} topics, ${r.problems} problems (version ${r.version}).`);
          } catch (e) {
            setContentNote(`Could not update: ${e instanceof Error ? e.message : "unknown error"}`);
          }
        }} />
        {contentNote ? <Notice text={contentNote} tone="info" /> : null}
      </Card>

      <Card>
        <H level={2}>Diagnostics</H>
        <P>Crash reports stay on this phone. Nothing is sent unless you share them. Emails and tokens are removed first.</P>
        <Button label="Share crash reports" hint="Opens the share sheet; you choose where to send them" onPress={async () => { await Share.share({ message: await reportsText() }); }} />
        <Button label="Clear crash reports" variant="danger" onPress={() => void clearReports()} />
      </Card>

      <Card>
        <H level={2}>Account</H>
        <P>To delete your account and all its data, use the Account screen. It asks for your password.</P>
        <Button label="Go to the Account screen" onPress={() => router.push("/account" as never)} />
      </Card>

      <Card>
        <H level={2}>Clear data on this device</H>
        <P>Removes your progress, notes, mistakes and unsent changes from this device. It does not affect your account on the server.
          You need to be signed out first.</P>
        {message ? <Notice text={message} tone={message.startsWith("Removed") ? "ok" : "error"} /> : null}
        {!signedIn ? (
          confirming ? (
            <>
              <Notice text="This removes everything listed above from this device. It cannot be undone." tone="error" />
              <Button
                label="Yes, clear data on this device"
                variant="danger"
                onPress={async () => {
                  const r = await clearLocalData();
                  setConfirming(false);
                  setMessage(r.ok ? "Removed everything from this device." : r.reason);
                }}
              />
              <Button label="Cancel" onPress={() => setConfirming(false)} />
            </>
          ) : (
            <Button label="Clear data on this device" onPress={() => setConfirming(true)} />
          )
        ) : (
          <Notice text="Sign out first to clear data on this device." />
        )}
      </Card>

      <Card>
        <H level={2}>About</H>
        <P>{`Algoryva ${version}. Lessons, practice problems and visualizations for algorithms and data structures.`}</P>
        <P>Answers are checked by the server by comparing the text you enter with the expected output. The app does not run your code.</P>
      </Card>
      <View style={s.spacer} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c, f) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  spacer: { height: 8 },
}));
