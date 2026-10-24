import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { isSignedIn } from "../../lib/auth/session";
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
