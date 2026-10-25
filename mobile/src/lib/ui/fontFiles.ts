// The font files, for expo-font's useFonts. Imported only by the root layout, so Node tests never load binary files.
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { FONTS } from "./fonts";

export const FONT_FILES = {
  [FONTS.regular]: BricolageGrotesque_400Regular,
  [FONTS.medium]: BricolageGrotesque_500Medium,
  [FONTS.semibold]: BricolageGrotesque_600SemiBold,
  [FONTS.bold]: BricolageGrotesque_700Bold,
  [FONTS.extrabold]: BricolageGrotesque_800ExtraBold,
  [FONTS.mono]: JetBrainsMono_400Regular,
  [FONTS.monoMedium]: JetBrainsMono_500Medium,
  [FONTS.monoBold]: JetBrainsMono_700Bold,
};
