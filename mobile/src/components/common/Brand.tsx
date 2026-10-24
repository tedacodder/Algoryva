import { Image, Text, View } from "react-native";
import { makeStyles } from "../../lib/ui/theme";

/** The Algoryva mark (the logo from the brand files) with the name beside it. Used in headers and on the home screen. */
const MARK = require("../../../assets/brand/mark.png");

const useStyles = makeStyles((c, f) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 34, height: 30 },
  name: { fontFamily: f.extrabold, fontSize: 22, color: c.logoWord, letterSpacing: -0.5 },
}));

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { s } = useStyles();
  const scale = size === "lg" ? 1.6 : size === "sm" ? 0.8 : 1;
  return (
    <View style={s.row} accessibilityRole="header" accessibilityLabel="Algoryva">
      <Image source={MARK} style={[s.mark, { width: 34 * scale, height: 30 * scale }]} accessibilityIgnoresInvertColors resizeMode="contain" />
      <Text style={[s.name, { fontSize: 22 * scale }]}>Algoryva</Text>
    </View>
  );
}
